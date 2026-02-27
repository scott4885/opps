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

export async function mapFileToMetrics(
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
