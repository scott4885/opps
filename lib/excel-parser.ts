/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export function parseFile(buffer: Buffer, filename: string): ParsedSheet[] {
  const ext = filename.toLowerCase();

  if (ext.endsWith('.csv')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
    const headers = (data[0] || []).map(String);
    const rows = data
      .slice(1)
      .filter((r: unknown[]) => r.some((c) => c !== null && c !== ''))
      .map((r: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => (obj[h] = r[i]));
        return obj;
      });
    return [{ sheetName: 'Sheet1', headers, rows }];
  }

  const wb = XLSX.read(buffer, { type: 'buffer' });
  return wb.SheetNames.map((name: string) => {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

    // Find header row (most non-null values in first 5 rows)
    let headerRow = 0;
    let maxCols = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const cols = data[i].filter((c) => c !== null && c !== '').length;
      if (cols > maxCols) {
        maxCols = cols;
        headerRow = i;
      }
    }

    const headers = data[headerRow].map((c) => String(c || '').trim());
    const rows = data
      .slice(headerRow + 1)
      .filter((r: unknown[]) => r.some((c) => c !== null && c !== ''))
      .map((r: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          if (h) obj[h] = r[i];
        });
        return obj;
      });

    return { sheetName: name, headers, rows };
  });
}
