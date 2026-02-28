import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MappingResult {
  entityColumn: string | null;
  entityType: string;
  dateColumn: string | null;
  fields: Array<{
    column: string;
    metricSlug: string;
    metricName: string;
    category: string;
    unit: string;
    description: string;
  }>;
  dataSourceName: string;
  confidence: number;
  notes: string;
}

/**
 * Rule-based fallback mapper that fires when AI mapping is unavailable.
 * Detects entity columns by keyword matching and infers metric categories from header names.
 */
export function ruleBasedMapper(
  sheetName: string,
  headers: string[],
  rows: Record<string, unknown>[]
): MappingResult {
  // Detect entity column: first column that looks like a name/location
  const entityKeywords = /name|location|branch|office|practice|store|site|department|region|entity/i;
  const entityColumn = headers.find((h) => entityKeywords.test(h)) ?? headers[0];

  // Detect date column — match specific date-like headers, not words like "Monthly Revenue"
  const dateKeywords = /\b(date|period|quarter|week)\b|^month$|^year$/i;
  const dateColumn = headers.find((h) => dateKeywords.test(h)) ?? null;

  // Detect numeric metric columns (exclude entity and date columns)
  const fields = headers
    .filter((h) => h !== entityColumn && (!dateColumn || h !== dateColumn))
    .map((h) => {
      // Infer category from header name
      let category = 'efficiency';
      if (/revenue|sales|income|gross|net|collection|production/i.test(h)) category = 'revenue';
      else if (/cost|expense|spend|overhead|labor/i.test(h)) category = 'cost';
      else if (/capacity|utilization|occupancy|fill/i.test(h)) category = 'capacity';
      else if (/retention|churn|turnover|satisfaction/i.test(h)) category = 'retention';

      let unit = 'count';
      if (/\$|revenue|sales|income|cost|expense|amount|balance|payment|fee/i.test(h)) unit = 'dollar';
      else if (/%|rate|pct|percent|ratio/i.test(h)) unit = 'percent';

      return {
        column: h,
        metricName: h,
        metricSlug: h
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        category,
        unit,
        description: `${h} from ${sheetName}`,
      };
    })
    .filter((f) => {
      // Only include columns that have numeric values in the first 5 rows
      const sample = rows
        .slice(0, 5)
        .map((r) => r[f.column])
        .filter(Boolean);
      return sample.some((v) => !isNaN(parseFloat(String(v).replace(/[$,%]/g, ''))));
    });

  return {
    dataSourceName: sheetName,
    entityColumn,
    entityType: 'location',
    dateColumn,
    fields: fields.slice(0, 20), // cap at 20 metrics per sheet
    confidence: 0.5,
    notes: 'Mapped using rule-based fallback (AI unavailable)',
  };
}

export async function mapFileToMetrics(
  sheetName: string,
  headers: string[],
  sampleRows: Record<string, unknown>[],
  businessProfile: string
): Promise<MappingResult> {
  try {
    return await callAI(sheetName, headers, sampleRows, businessProfile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[ai-mapper] AI failed, using rule-based fallback:', message);
    return ruleBasedMapper(sheetName, headers, sampleRows);
  }
}

async function callAI(
  sheetName: string,
  headers: string[],
  sampleRows: Record<string, unknown>[],
  businessProfile: string
): Promise<MappingResult> {
  const prompt = `You are a data analyst for Opps. — a business intelligence platform.

BUSINESS PROFILE:
${businessProfile}

You received a data file with sheet name: "${sheetName}"
Headers: ${JSON.stringify(headers)}
Sample rows (first 3): ${JSON.stringify(sampleRows.slice(0, 3), null, 2)}

Your job:
1. Identify which column contains entity names (locations, departments, SKUs, etc) — or null if this is a summary file
2. Identify what TYPE of entity these are (location, practice, department, sku, route, employee, etc)
3. Identify which column contains a date/period, if any
4. Map every meaningful numeric column to a business metric with: slug (snake_case), name, category, unit, description
5. Name the data source based on what the file appears to be

Categories: revenue, cost, efficiency, capacity, retention
Units: dollar, percent, count, days, ratio

Return ONLY valid JSON matching this exact schema:
{
  "entityColumn": "column name or null",
  "entityType": "location",
  "dateColumn": "column name or null",
  "fields": [
    {
      "column": "exact column name from headers",
      "metricSlug": "snake_case_slug",
      "metricName": "Human Readable Name",
      "category": "revenue",
      "unit": "dollar",
      "description": "what this metric measures"
    }
  ],
  "dataSourceName": "Descriptive Source Name",
  "confidence": 0.95,
  "notes": "any important observations"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find((c) => c.type === 'text')?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI mapper returned no JSON');
  return JSON.parse(jsonMatch[0]) as MappingResult;
}
