import type { IDataObject } from 'n8n-workflow';

export type OfrDataPoint = [string | number, number | null];

/**
 * Converts any n8n date/dateTime value (ISO string, Luxon DateTime, JS Date)
 * into the `YYYY-MM-DD` format expected by the OFR API.
 */
export function toOfrDate(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const raw =
		typeof value === 'object' && value !== null && 'toISO' in value
			? (value as { toISO: () => string }).toISO()
			: value instanceof Date
				? value.toISOString()
				: String(value);
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
	return match ? match[1] : raw.trim();
}

/**
 * Turns `[[date, value], ...]` into `[{ date, value }, ...]`.
 */
export function pointsToObjects(points: unknown): IDataObject[] {
	if (!Array.isArray(points)) return [];
	return (points as OfrDataPoint[]).map(([date, value]) => ({ date, value }));
}

/**
 * Turns a header such as "Other advanced economies" into "other_advanced_economies".
 */
export function slugify(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * Minimal RFC 4180 CSV parser (handles quoted fields, escaped quotes and CRLF).
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	const input = text.replace(/^\uFEFF/, '');

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (inQuotes) {
			if (char === '"') {
				if (input[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}
		if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && input[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += char;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Converts a CSV cell into a number when it looks numeric, null when empty.
 */
export function castCell(value: string): string | number | null {
	const trimmed = value.trim();
	if (trimmed === '' || trimmed.toLowerCase() === 'nan' || trimmed.toLowerCase() === 'null') {
		return null;
	}
	if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return trimmed;
}

/**
 * Parses CSV text into objects keyed by (optionally slugified) header names.
 */
export function csvToObjects(text: string, slugifyHeaders = true): IDataObject[] {
	const rows = parseCsv(text);
	if (rows.length === 0) return [];
	const headers = rows[0].map((h, i) => (slugifyHeaders ? slugify(h) : h.trim()) || `column_${i}`);
	return rows.slice(1).map((cells) => {
		const obj: IDataObject = {};
		headers.forEach((header, i) => {
			obj[header] = castCell(cells[i] ?? '');
		});
		return obj;
	});
}
