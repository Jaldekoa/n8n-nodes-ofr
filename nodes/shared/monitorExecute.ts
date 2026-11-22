import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ofrApiRequest, toNodeError } from './transport';
import { csvToObjects, pointsToObjects, toOfrDate } from './utils';

interface SeriesEntry {
	timeseries?: Record<string, unknown>;
	metadata?: IDataObject;
}

type MnemonicEntry = string | { mnemonic: string; series_name?: string };

/**
 * Turns the `{ MNEMONIC: { timeseries, metadata } }` structure returned by
 * /series/full, /series/multifull and /series/dataset into one item per series.
 */
function seriesMapToItems(
	map: Record<string, SeriesEntry>,
	extra: IDataObject = {},
): IDataObject[] {
	return Object.entries(map ?? {}).map(([mnemonic, entry]) => {
		const timeseries: IDataObject = {};
		for (const [label, points] of Object.entries(entry?.timeseries ?? {})) {
			timeseries[label] = pointsToObjects(points);
		}
		const description = (entry?.metadata?.description ?? {}) as IDataObject;
		return {
			mnemonic,
			name: description.name,
			...extra,
			data: timeseries.aggregation ?? [],
			timeseries,
			metadata: entry?.metadata ?? {},
		};
	});
}

function getMnemonic(this: IExecuteFunctions, name: string, itemIndex: number): string {
	const value = this.getNodeParameter(name, itemIndex, '', { extractValue: true }) as string;
	const trimmed = String(value ?? '').trim();
	if (!trimmed) {
		throw new NodeOperationError(this.getNode(), `The parameter "${name}" is required`, {
			itemIndex,
		});
	}
	return trimmed;
}

function getDataOptions(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const qs: IDataObject = {};
	if (options.start_date) qs.start_date = toOfrDate(options.start_date);
	if (options.end_date) qs.end_date = toOfrDate(options.end_date);
	if (options.periodicity) qs.periodicity = options.periodicity;
	if (options.how) qs.how = options.how;
	if (options.remove_nulls === true) qs.remove_nulls = 'true';
	if (options.time_format) qs.time_format = options.time_format;
	return qs;
}

async function executeSeries(
	this: IExecuteFunctions,
	baseUrl: string,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;
	const qs = getDataOptions.call(this, itemIndex);

	if (operation === 'getTimeseries' || operation === 'getSpread') {
		let path: string;
		let base: IDataObject;
		if (operation === 'getTimeseries') {
			const mnemonic = getMnemonic.call(this, 'mnemonic', itemIndex);
			const label = this.getNodeParameter('label', itemIndex, 'aggregation') as string;
			path = '/series/timeseries';
			qs.mnemonic = mnemonic;
			qs.label = label;
			base = { mnemonic: mnemonic.toUpperCase(), label };
		} else {
			const x = getMnemonic.call(this, 'x', itemIndex);
			const y = getMnemonic.call(this, 'y', itemIndex);
			path = '/calc/spread';
			qs.x = x;
			qs.y = y;
			base = { x: x.toUpperCase(), y: y.toUpperCase() };
		}
		const response = await ofrApiRequest.call(this, baseUrl, path, qs);
		const points = pointsToObjects(response);
		if (!simplify) return [{ ...base, data: response as IDataObject[] }];
		return points.map((point) => ({ ...base, ...point }));
	}

	if (operation === 'getFull' || operation === 'getMultiFull') {
		let path = '/series/full';
		if (operation === 'getFull') {
			qs.mnemonic = getMnemonic.call(this, 'mnemonic', itemIndex);
		} else {
			path = '/series/multifull';
			const mnemonics = (this.getNodeParameter('mnemonics', itemIndex, '') as string)
				.split(',')
				.map((m) => m.trim())
				.filter(Boolean);
			if (!mnemonics.length) {
				throw new NodeOperationError(this.getNode(), 'At least one mnemonic is required', {
					itemIndex,
				});
			}
			qs.mnemonics = mnemonics.join(',');
		}
		const response = (await ofrApiRequest.call(this, baseUrl, path, qs)) as Record<
			string,
			SeriesEntry
		>;
		if (!simplify) return [response as IDataObject];
		return seriesMapToItems(response);
	}

	if (operation === 'getDataset') {
		qs.dataset = this.getNodeParameter('dataset', itemIndex) as string;
		qs.vintage = this.getNodeParameter('vintage', itemIndex, '') as string;
		const response = (await ofrApiRequest.call(this, baseUrl, '/series/dataset', qs)) as {
			short_name?: string;
			long_name?: string;
			timeseries?: Record<string, SeriesEntry>;
		};
		if (!simplify) return [response as IDataObject];
		return seriesMapToItems(response.timeseries ?? {}, { dataset: qs.dataset });
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, {
		itemIndex,
	});
}

async function executeMetadata(
	this: IExecuteFunctions,
	baseUrl: string,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	if (operation === 'listMnemonics') {
		const dataset = this.getNodeParameter('dataset', itemIndex, '') as string;
		if (dataset) {
			const response = (await ofrApiRequest.call(this, baseUrl, '/metadata/mnemonics', {
				dataset,
			})) as MnemonicEntry[];
			return response.map((entry) =>
				typeof entry === 'string' ? { mnemonic: entry, dataset } : { ...entry, dataset },
			);
		}
		const response = (await ofrApiRequest.call(this, baseUrl, '/metadata/mnemonics', {
			output: 'by_dataset',
		})) as Record<string, MnemonicEntry[]>;
		const items: IDataObject[] = [];
		for (const [ds, entries] of Object.entries(response ?? {})) {
			for (const entry of entries ?? []) {
				items.push(
					typeof entry === 'string' ? { mnemonic: entry, dataset: ds } : { ...entry, dataset: ds },
				);
			}
		}
		return items;
	}

	if (operation === 'getMetadata') {
		const mnemonic = getMnemonic.call(this, 'mnemonic', itemIndex);
		const fields = (this.getNodeParameter('fields', itemIndex, '') as string)
			.split(',')
			.map((f) => f.trim())
			.filter(Boolean)
			.join(',');
		const response = await ofrApiRequest.call(this, baseUrl, '/metadata/query', {
			mnemonic,
			fields,
		});
		return [{ mnemonic: mnemonic.toUpperCase(), ...(response as IDataObject) }];
	}

	if (operation === 'search') {
		const query = (this.getNodeParameter('query', itemIndex, '') as string).trim();
		if (!query) {
			throw new NodeOperationError(this.getNode(), 'The search query cannot be empty', {
				itemIndex,
			});
		}
		const response = await ofrApiRequest.call(this, baseUrl, '/metadata/search', { query });
		return Array.isArray(response) ? (response as IDataObject[]) : [response as IDataObject];
	}

	if (operation === 'listDatasets') {
		const response = (await ofrApiRequest.call(this, baseUrl, '/series/dataset')) as Record<
			string,
			IDataObject
		>;
		return Object.entries(response ?? {}).map(([dataset, info]) => ({ dataset, ...info }));
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, {
		itemIndex,
	});
}

async function executeCategory(
	this: IExecuteFunctions,
	baseUrl: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const category = this.getNodeParameter('category', itemIndex) as string;
	const output = this.getNodeParameter('categoryOutput', itemIndex, 'rows') as string;
	const csv = String(
		(await ofrApiRequest.call(this, baseUrl, '/categories', { category }, true)) ?? '',
	);

	if (output === 'text') {
		return [{ json: { category, csv }, pairedItem: { item: itemIndex } }];
	}
	if (output === 'binary') {
		const binary = await this.helpers.prepareBinaryData(
			Buffer.from(csv, 'utf8'),
			`ofr_hfm_${category}.csv`,
			'text/csv',
		);
		return [{ json: { category }, binary: { data: binary }, pairedItem: { item: itemIndex } }];
	}
	return csvToObjects(csv, false).map((row) => ({
		json: { category, ...row },
		pairedItem: { item: itemIndex },
	}));
}

/**
 * Shared `execute()` implementation for the OFR monitor nodes (HFM & STFM).
 */
export async function executeMonitor(
	this: IExecuteFunctions,
	baseUrl: string,
): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const resource = this.getNodeParameter('resource', itemIndex) as string;
			const operation = this.getNodeParameter('operation', itemIndex) as string;

			if (resource === 'category') {
				returnData.push(...(await executeCategory.call(this, baseUrl, itemIndex)));
				continue;
			}

			const results =
				resource === 'metadata'
					? await executeMetadata.call(this, baseUrl, operation, itemIndex)
					: await executeSeries.call(this, baseUrl, operation, itemIndex);

			for (const json of results) {
				returnData.push({ json, pairedItem: { item: itemIndex } });
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: itemIndex },
				});
				continue;
			}
			throw toNodeError(this.getNode(), error, itemIndex);
		}
	}

	return [returnData];
}

/**
 * Shared list-search implementation: lets the user pick a series by mnemonic or name.
 */
export async function searchMnemonics(
	this: ILoadOptionsFunctions,
	baseUrl: string,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = (await ofrApiRequest.call(this, baseUrl, '/metadata/mnemonics', {
		output: 'by_dataset',
	})) as Record<string, MnemonicEntry[]>;

	const needle = (filter ?? '').trim().toLowerCase();
	const results: INodeListSearchItems[] = [];

	for (const [dataset, entries] of Object.entries(response ?? {})) {
		for (const entry of entries ?? []) {
			const mnemonic = typeof entry === 'string' ? entry : entry.mnemonic;
			const seriesName = typeof entry === 'string' ? '' : (entry.series_name ?? '');
			const haystack = `${mnemonic} ${seriesName} ${dataset}`.toLowerCase();
			if (needle && !haystack.includes(needle)) continue;
			results.push({
				name: seriesName ? `${seriesName} (${mnemonic})` : mnemonic,
				value: mnemonic,
			});
		}
	}

	results.sort((a, b) => a.name.localeCompare(b.name));
	return { results };
}
