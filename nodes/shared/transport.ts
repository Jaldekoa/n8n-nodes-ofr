import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const OFR_API_HOST = 'https://data.financialresearch.gov';
export const OFR_WEBSITE_HOST = 'https://www.financialresearch.gov';

type OfrContext = IExecuteFunctions | ILoadOptionsFunctions;

/**
 * Removes empty values so that the OFR API applies its own defaults.
 */
function cleanQuery(qs: IDataObject): IDataObject {
	const cleaned: IDataObject = {};
	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		cleaned[key] = value;
	}
	return cleaned;
}

/**
 * Performs a GET request against an OFR endpoint.
 *
 * @param baseUrl Full base URL including the API version, e.g. `https://data.financialresearch.gov/hf/v1`
 * @param path    Endpoint path, e.g. `/series/timeseries`
 * @param asText  When true the raw body is returned as a string (CSV endpoints)
 */
export async function ofrApiRequest(
	this: OfrContext,
	baseUrl: string,
	path: string,
	qs: IDataObject = {},
	asText = false,
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `${baseUrl}${path}`,
		qs: cleanQuery(qs),
		headers: {
			Accept: asText ? 'text/csv, text/plain, */*' : 'application/json',
		},
		json: !asText,
	};

	if (asText) {
		options.encoding = 'text';
	}

	try {
		return await this.helpers.httpRequest(options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: `OFR request to ${path} failed`,
		});
	}
}

/**
 * Normalises any error thrown while processing an item into an n8n error
 * carrying the item index (existing n8n errors are returned unchanged).
 */
export function toNodeError(
	node: INode,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		error.context.itemIndex = itemIndex;
	}
	if (error instanceof NodeApiError) {
		return new NodeApiError(node, error as unknown as JsonObject, { itemIndex });
	}
	return new NodeOperationError(node, error as Error, { itemIndex });
}
