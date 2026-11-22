/* eslint-disable n8n-nodes-base/node-param-default-missing -- dataset/category defaults are injected per node via MonitorConfig */
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export interface MonitorConfig {
	/** Data sets exposed by this monitor (used by the `dataset` parameter). */
	datasets: INodePropertyOptions[];
	/** Example mnemonic shown as placeholder. */
	exampleMnemonic: string;
	/** Second example mnemonic (for spreads / multi-series). */
	exampleMnemonic2: string;
	/** Category CSV downloads (Hedge Fund Monitor only). */
	categories?: INodePropertyOptions[];
}

const PERIODICITY_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Business Day (Weekday)', value: 'B' },
	{ name: 'Business Month End', value: 'BM' },
	{ name: 'Business Month Start', value: 'BMS' },
	{ name: 'Business Quarter End', value: 'BQ' },
	{ name: 'Business Quarter Start', value: 'BQS' },
	{ name: 'Business Year End', value: 'BA' },
	{ name: 'Business Year Start', value: 'BAS' },
	{ name: 'Calendar Month End', value: 'M' },
	{ name: 'Calendar Month Start', value: 'MS' },
	{ name: 'Calendar Year End', value: 'A' },
	{ name: 'Calendar Year Start', value: 'AS' },
	{ name: 'Daily', value: 'D' },
	{ name: 'Quarter End', value: 'Q' },
	{ name: 'Quarter Start', value: 'QS' },
	{ name: 'Weekly (Sunday Start)', value: 'W' },
];

function mnemonicLocator(
	name: string,
	displayName: string,
	description: string,
	placeholder: string,
	show: Record<string, string[]>,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description,
		displayOptions: { show },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a series...',
				typeOptions: {
					searchListMethod: 'searchMnemonics',
					searchable: true,
				},
			},
			{
				displayName: 'By Mnemonic',
				name: 'id',
				type: 'string',
				placeholder,
			},
		],
	};
}

export function buildMonitorProperties(config: MonitorConfig): INodeProperties[] {
	const hasCategories = !!config.categories?.length;

	const resourceOptions: INodePropertyOptions[] = [
		{ name: 'Series Data', value: 'series', description: 'Retrieve time series observations' },
		{ name: 'Metadata', value: 'metadata', description: 'Discover series and their metadata' },
	];
	if (hasCategories) {
		resourceOptions.push({
			name: 'Category',
			value: 'category',
			description: 'Download all data of a monitor category (CSV)',
		});
	}

	const seriesDataOps = ['getTimeseries', 'getSpread', 'getFull', 'getMultiFull', 'getDataset'];

	const properties: INodeProperties[] = [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: resourceOptions,
			default: 'series',
		},

		// ------------------------------------------------------------------
		// Operations
		// ------------------------------------------------------------------
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: ['series'] } },
			options: [
				{
					name: 'Get Data Set',
					value: 'getDataset',
					action: 'Get all series of a data set',
					description: 'Return data and metadata for every series in a data set',
				},
				{
					name: 'Get Full Series',
					value: 'getFull',
					action: 'Get series data and metadata',
					description: 'Return all subseries data and metadata for one series',
				},
				{
					name: 'Get Multiple Series',
					value: 'getMultiFull',
					action: 'Get data and metadata for multiple series',
					description: 'Return data and metadata for several series at once',
				},
				{
					name: 'Get Spread',
					value: 'getSpread',
					action: 'Get the spread between two series',
					description: 'Return the difference between two series (X − Y)',
				},
				{
					name: 'Get Time Series',
					value: 'getTimeseries',
					action: 'Get time series observations',
					description: 'Return date/value pairs for one series',
				},
			],
			default: 'getTimeseries',
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: ['metadata'] } },
			options: [
				{
					name: 'Get Series Metadata',
					value: 'getMetadata',
					action: 'Get metadata of a series',
					description: 'Return the metadata (all or selected fields) of one series',
				},
				{
					name: 'List Data Sets',
					value: 'listDatasets',
					action: 'List data sets',
					description: 'Return the available data sets with their names',
				},
				{
					name: 'List Mnemonics',
					value: 'listMnemonics',
					action: 'List series mnemonics',
					description: 'Return the identifiers (mnemonics) of the available series',
				},
				{
					name: 'Search',
					value: 'search',
					action: 'Search series metadata',
					description: 'Find series whose metadata matches a query (supports * and ? wildcards)',
				},
			],
			default: 'listMnemonics',
		},
	];

	if (hasCategories) {
		properties.push({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: ['category'] } },
			options: [
				{
					name: 'Get Category Data',
					value: 'getCategory',
					action: 'Get category data',
					description: 'Download the CSV with all data of a category',
				},
			],
			default: 'getCategory',
		});
	}

	properties.push(
		// ------------------------------------------------------------------
		// Series parameters
		// ------------------------------------------------------------------
		mnemonicLocator(
			'mnemonic',
			'Series',
			'The series (mnemonic) to retrieve',
			`e.g. ${config.exampleMnemonic}`,
			{ resource: ['series'], operation: ['getTimeseries', 'getFull'] },
		),
		{
			displayName: 'Subseries',
			name: 'label',
			type: 'options',
			displayOptions: { show: { resource: ['series'], operation: ['getTimeseries'] } },
			options: [
				{ name: 'Aggregation', value: 'aggregation' },
				{ name: 'Disclosure Edits', value: 'disclosure_edits' },
			],
			default: 'aggregation',
			description: 'Which subseries of the mnemonic to return',
		},
		mnemonicLocator(
			'x',
			'Series X (Base)',
			'Base series. The spread is computed as X − Y.',
			`e.g. ${config.exampleMnemonic}`,
			{ resource: ['series'], operation: ['getSpread'] },
		),
		mnemonicLocator(
			'y',
			'Series Y (Subtracted)',
			'Series subtracted from X',
			`e.g. ${config.exampleMnemonic2}`,
			{ resource: ['series'], operation: ['getSpread'] },
		),
		{
			displayName: 'Mnemonics',
			name: 'mnemonics',
			type: 'string',
			required: true,
			default: '',
			placeholder: `${config.exampleMnemonic},${config.exampleMnemonic2}`,
			description: 'Comma-separated list of series mnemonics',
			displayOptions: { show: { resource: ['series'], operation: ['getMultiFull'] } },
		},
		{
			displayName: 'Data Set',
			name: 'dataset',
			type: 'options',
			required: true,
			options: config.datasets,
			default: config.datasets[0].value,
			displayOptions: { show: { resource: ['series'], operation: ['getDataset'] } },
		},
		{
			displayName: 'Vintage',
			name: 'vintage',
			type: 'options',
			options: [
				{ name: 'All', value: '' },
				{ name: 'Preliminary', value: 'p' },
				{ name: 'Final', value: 'f' },
				{ name: 'As Of', value: 'a' },
			],
			default: '',
			description: 'Restrict the data set to series of a given vintage',
			displayOptions: { show: { resource: ['series'], operation: ['getDataset'] } },
		},
		{
			displayName: 'Simplify',
			name: 'simplify',
			type: 'boolean',
			default: true,
			description:
				'Whether to return a simplified version of the response instead of the raw data. Time series become one item per observation; full/multiple/data set responses become one item per series.',
			displayOptions: { show: { resource: ['series'] } },
		},
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: { show: { resource: ['series'], operation: seriesDataOps } },
			options: [
				{
					displayName: 'Aggregation Method',
					name: 'how',
					type: 'options',
					options: [
						{ name: 'First', value: 'first', description: 'First value of the period' },
						{ name: 'Last', value: 'last', description: 'Last value of the period' },
						{ name: 'Mean', value: 'mean' },
						{ name: 'Median', value: 'median' },
						{ name: 'Sum', value: 'sum', description: 'Sum of all values in the period' },
					],
					default: 'last',
					description: 'How to compute the value of each period when changing the periodicity',
				},
				{
					displayName: 'End Date',
					name: 'end_date',
					type: 'dateTime',
					default: '',
					description: 'Last date to return. Defaults to today.',
				},
				{
					displayName: 'Periodicity',
					name: 'periodicity',
					type: 'options',
					options: PERIODICITY_OPTIONS,
					default: 'M',
					description: 'Convert the series to this frequency',
				},
				{
					displayName: 'Remove Nulls',
					name: 'remove_nulls',
					type: 'boolean',
					default: true,
					description: 'Whether to remove observations with null values',
				},
				{
					displayName: 'Start Date',
					name: 'start_date',
					type: 'dateTime',
					default: '',
					description: 'First date to return. Defaults to 1901-01-01.',
				},
				{
					displayName: 'Time Format',
					name: 'time_format',
					type: 'options',
					options: [
						{ name: 'Date (YYYY-MM-DD)', value: 'date' },
						{ name: 'Milliseconds Since Epoch', value: 'ms' },
					],
					default: 'date',
				},
			],
		},

		// ------------------------------------------------------------------
		// Metadata parameters
		// ------------------------------------------------------------------
		{
			displayName: 'Data Set',
			name: 'dataset',
			type: 'options',
			options: [{ name: 'All Data Sets', value: '' }, ...config.datasets],
			default: '',
			description: 'Only list mnemonics of this data set',
			displayOptions: { show: { resource: ['metadata'], operation: ['listMnemonics'] } },
		},
		mnemonicLocator(
			'mnemonic',
			'Series',
			'The series (mnemonic) whose metadata to return',
			`e.g. ${config.exampleMnemonic}`,
			{ resource: ['metadata'], operation: ['getMetadata'] },
		),
		{
			displayName: 'Fields',
			name: 'fields',
			type: 'string',
			default: '',
			placeholder: 'e.g. description/name,schedule,release/long_name',
			description:
				'Comma-separated metadata fields to return. Use "/" for subfields. Leave empty to return all metadata.',
			displayOptions: { show: { resource: ['metadata'], operation: ['getMetadata'] } },
		},
		{
			displayName: 'Query',
			name: 'query',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'e.g. *repo*',
			description: 'Search text. Wildcards * (any characters) and ? (one character) are supported.',
			displayOptions: { show: { resource: ['metadata'], operation: ['search'] } },
		},
	);

	// --------------------------------------------------------------------
	// Category parameters (HFM)
	// --------------------------------------------------------------------
	if (hasCategories) {
		properties.push(
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				required: true,
				options: config.categories!,
				default: config.categories![0].value,
				displayOptions: { show: { resource: ['category'], operation: ['getCategory'] } },
			},
			{
				displayName: 'Output',
				name: 'categoryOutput',
				type: 'options',
				options: [
					{ name: 'One Item per Row', value: 'rows' },
					{ name: 'Raw CSV Text', value: 'text' },
					{ name: 'Binary File', value: 'binary' },
				],
				default: 'rows',
				displayOptions: { show: { resource: ['category'], operation: ['getCategory'] } },
			},
		);
	}

	return properties;
}
