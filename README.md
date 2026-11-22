# n8n-nodes-ofr

n8n community nodes for the U.S. [Office of Financial Research (OFR)](https://www.financialresearch.gov/).

Installing this package adds **three nodes**:

| Node                               | Source                                                                                                                  | Data                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **OFR Hedge Fund Monitor**         | [HFM API](https://www.financialresearch.gov/hedge-fund-monitor/api/) (`https://data.financialresearch.gov/hf/v1`)       | SEC Form PF, CFTC Traders in Financial Futures, Senior Credit Officer Opinion Survey (SCOOS), FICC Sponsored Repo                         |
| **OFR Short-Term Funding Monitor** | [STFM API](https://www.financialresearch.gov/short-term-funding-monitor/api/) (`https://data.financialresearch.gov/v1`) | Money market funds, U.S. repo markets, FRBNY reference rates (SOFR, EFFR, …), primary dealer statistics, Treasury constant maturity rates |
| **OFR Financial Stress Index**     | [FSI CSV download](https://www.financialresearch.gov/financial-stress-index/) (no API)                                  | Daily OFR FSI and its components                                                                                                          |

No credentials are needed: the OFR APIs are public and require no token or registration.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-ofr`.

## Operations

### OFR Hedge Fund Monitor / OFR Short-Term Funding Monitor

Both monitor nodes share the same operations (the OFR uses the same API design for both):

**Series Data**

- **Get Time Series**: `/series/timeseries`. Date/value pairs for one series (aggregation or disclosure edits subseries).
- **Get Spread**: `/calc/spread`. Difference X − Y between two series.
- **Get Full Series**: `/series/full`. All subseries plus metadata for one series.
- **Get Multiple Series**: `/series/multifull`. Data and metadata for a comma-separated list of series.
- **Get Data Set**: `/series/dataset`. All series of a data set, optionally filtered by vintage (preliminary/final/as of).

All series operations accept these optional parameters: start date, end date, periodicity (daily, weekly, monthly, quarterly, yearly, business variants), aggregation method (first, last, mean, median, sum), remove nulls and time format (date or epoch milliseconds).

With **Simplify** on (the default), time series and spreads return one item per observation (`{ mnemonic, date, value }`), and full, multiple and data set responses return one item per series (`{ mnemonic, name, data, timeseries, metadata }`). Turn it off to get the raw API response.

**Metadata**

- **List Mnemonics**: `/metadata/mnemonics`. All series identifiers, optionally for one data set.
- **Get Series Metadata**: `/metadata/query`. All metadata, or selected fields (`description/name,release/long_name`).
- **Search**: `/metadata/search`. Search metadata with `*` and `?` wildcards.
- **List Data Sets**: `/series/dataset` (no parameters). Available data sets.

**Category** (Hedge Fund Monitor only)

- **Get Category Data**: `/categories`. The CSV with all data of a category (complexity, counterparties, leverage, liquidity, risk management, size), returned as one item per row, raw text or a binary file.

Series parameters can be chosen from a searchable list (by name or mnemonic) or entered by mnemonic.

### OFR Financial Stress Index

- **Get Latest**: the latest N daily observations.
- **Get History**: daily observations between two optional dates.

You can choose which columns to return (OFR FSI, credit, equity valuation, safe assets, funding, volatility, United States, other advanced economies, emerging markets), and whether to return one item per day or a single item with all rows.

## Development

```bash
npm install
npm run dev     # starts n8n with the nodes loaded (http://localhost:5678)
npm run lint
npm run build
```

## Resources

- [OFR Hedge Fund Monitor API](https://www.financialresearch.gov/hedge-fund-monitor/api/)
- [OFR Short-term Funding Monitor API](https://www.financialresearch.gov/short-term-funding-monitor/api/)
- [OFR Financial Stress Index](https://www.financialresearch.gov/financial-stress-index/)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE.md)
