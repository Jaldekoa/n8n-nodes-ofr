import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { OFR_WEBSITE_HOST, ofrApiRequest, toNodeError } from '../shared/transport';
import { csvToObjects, toOfrDate } from '../shared/utils';

const FSI_CSV_PATH = '/financial-stress-index/data/fsi.csv';

/**
 * The OFR Financial Stress Index has no API: the OFR publishes the full daily
 * history as a CSV file on its website, which this node downloads and filters.
 */
export class OfrFinancialStressIndex implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OFR Financial Stress Index',
		name: 'ofrFinancialStressIndex',
		icon: { light: 'file:../../icons/ofr.svg', dark: 'file:../../icons/ofr.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Get the daily OFR Financial Stress Index (FSI) and its components',
		defaults: {
			name: 'OFR Financial Stress Index',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get History',
						value: 'getHistory',
						action: 'Get the FSI history',
						description: 'Return daily FSI values, optionally filtered by date',
					},
					{
						name: 'Get Latest',
						value: 'getLatest',
						action: 'Get the latest FSI values',
						description: 'Return the most recent FSI observations',
					},
				],
				default: 'getLatest',
			},
			{
				displayName: 'Number of Observations',
				name: 'count',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: 'How many of the most recent daily observations to return',
				displayOptions: { show: { operation: ['getLatest'] } },
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'First date to return. Leave empty to start at the beginning (2000).',
				displayOptions: { show: { operation: ['getHistory'] } },
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'Last date to return. Leave empty to return up to the latest observation.',
				displayOptions: { show: { operation: ['getHistory'] } },
			},
			{
				displayName: 'Columns',
				name: 'columns',
				type: 'multiOptions',
				options: [
					{ name: 'Credit', value: 'credit' },
					{ name: 'Emerging Markets', value: 'emerging_markets' },
					{ name: 'Equity Valuation', value: 'equity_valuation' },
					{ name: 'Funding', value: 'funding' },
					{ name: 'OFR FSI', value: 'ofr_fsi' },
					{ name: 'Other Advanced Economies', value: 'other_advanced_economies' },
					{ name: 'Safe Assets', value: 'safe_assets' },
					{ name: 'United States', value: 'united_states' },
					{ name: 'Volatility', value: 'volatility' },
				],
				default: [],
				description:
					'Columns to include (the date is always included). Leave empty to return all columns.',
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				options: [
					{ name: 'One Item per Day', value: 'rows' },
					{ name: 'Single Item with All Rows', value: 'single' },
				],
				default: 'rows',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		let cachedRows: IDataObject[] | undefined;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const columns = this.getNodeParameter('columns', itemIndex, []) as string[];
				const output = this.getNodeParameter('output', itemIndex, 'rows') as string;

				if (!cachedRows) {
					const csv = String(
						(await ofrApiRequest.call(this, OFR_WEBSITE_HOST, FSI_CSV_PATH, {}, true)) ?? '',
					);
					cachedRows = csvToObjects(csv)
						.filter((row) => typeof row.date === 'string' && row.date !== '')
						.sort((a, b) => String(a.date).localeCompare(String(b.date)));
				}

				let rows: IDataObject[];
				if (operation === 'getLatest') {
					const count = Math.max(1, this.getNodeParameter('count', itemIndex, 1) as number);
					rows = cachedRows.slice(-count);
				} else if (operation === 'getHistory') {
					const start = toOfrDate(this.getNodeParameter('startDate', itemIndex, ''));
					const end = toOfrDate(this.getNodeParameter('endDate', itemIndex, ''));
					rows = cachedRows.filter((row) => {
						const date = String(row.date);
						return (!start || date >= start) && (!end || date <= end);
					});
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, {
						itemIndex,
					});
				}

				if (columns.length) {
					rows = rows.map((row) => {
						const picked: IDataObject = { date: row.date };
						for (const column of columns) picked[column] = row[column] ?? null;
						return picked;
					});
				}

				if (output === 'single') {
					returnData.push({ json: { rows }, pairedItem: { item: itemIndex } });
				} else {
					for (const row of rows) {
						returnData.push({ json: { ...row }, pairedItem: { item: itemIndex } });
					}
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
}
