import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeListSearchResult,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { buildMonitorProperties } from '../shared/monitorDescription';
import { executeMonitor, searchMnemonics } from '../shared/monitorExecute';
import { OFR_API_HOST } from '../shared/transport';

const BASE_URL = `${OFR_API_HOST}/v1`;

export class OfrShortTermFundingMonitor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OFR Short-Term Funding Monitor',
		name: 'ofrShortTermFundingMonitor',
		icon: { light: 'file:../../icons/ofr.svg', dark: 'file:../../icons/ofr.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Get money market fund, repo, reference rate, primary dealer and Treasury yield data from the OFR Short-term Funding Monitor API',
		defaults: {
			name: 'OFR Short-Term Funding Monitor',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: buildMonitorProperties({
			datasets: [
				{ name: 'U.S. Money Market Funds (Mmf)', value: 'mmf' },
				{ name: 'U.S. Repo Markets (Repo)', value: 'repo' },
				{ name: 'FRBNY Reference Rates (Fnyr)', value: 'fnyr' },
				{ name: 'FRBNY Primary Dealer Statistics (Nypd)', value: 'nypd' },
				{ name: 'Treasury Constant Maturity Rates (Tyld)', value: 'tyld' },
			],
			exampleMnemonic: 'FNYR-SOFR-A',
			exampleMnemonic2: 'FNYR-EFFR-A',
		}),
	};

	methods = {
		listSearch: {
			async searchMnemonics(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				return searchMnemonics.call(this, BASE_URL, filter);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return executeMonitor.call(this, BASE_URL);
	}
}
