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

const BASE_URL = `${OFR_API_HOST}/hf/v1`;

export class OfrHedgeFundMonitor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OFR Hedge Fund Monitor',
		name: 'ofrHedgeFundMonitor',
		icon: { light: 'file:../../icons/ofr.svg', dark: 'file:../../icons/ofr.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Get hedge fund data (SEC Form PF, CFTC TFF, SCOOS, FICC sponsored repo) from the OFR Hedge Fund Monitor API',
		defaults: {
			name: 'OFR Hedge Fund Monitor',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: buildMonitorProperties({
			datasets: [
				{ name: 'SEC Form PF (Fpf)', value: 'fpf' },
				{ name: 'CFTC Traders in Financial Futures (Tff)', value: 'tff' },
				{ name: 'Senior Credit Officer Opinion Survey (Scoos)', value: 'scoos' },
				{ name: 'FICC Sponsored Repo Service Volumes (Ficc)', value: 'ficc' },
			],
			exampleMnemonic: 'FPF-ALLQHF_NAV_SUM',
			exampleMnemonic2: 'FPF-ALLQHF_GAV_SUM',
			categories: [
				{ name: 'Complexity', value: 'complexity' },
				{ name: 'Counterparties', value: 'counterparties' },
				{ name: 'Leverage', value: 'leverage' },
				{ name: 'Liquidity', value: 'liquidity' },
				{ name: 'Risk Management', value: 'risk_management' },
				{ name: 'Size', value: 'size' },
			],
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
