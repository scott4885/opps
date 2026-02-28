import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const oppId = parseInt(id);
  if (isNaN(oppId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const opp = await prisma.opportunity.findUnique({
    where: { id: oppId },
    include: {
      entity: {
        include: {
          metricValues: {
            where: { isLatest: true },
            include: { metric: true },
          },
        },
      },
      metrics: true,
    },
  });

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Return cached version if available
  if (opp.aiDetail && opp.aiNextSteps) {
    return NextResponse.json({ aiDetail: opp.aiDetail, aiNextSteps: opp.aiNextSteps });
  }

  // Build metric context for AI
  const entityMetrics = opp.entity?.metricValues.map((mv) => ({
    name: mv.metric.name,
    slug: mv.metric.slug,
    category: mv.metric.category,
    unit: mv.metric.unit,
    value: mv.value,
  })) || [];

  const linkedMetricSlugs = opp.metrics.map((m) => m.slug);

  const prompt = `You are an expert dental DSO business analyst. You have identified the following opportunity for a practice/entity.

OPPORTUNITY:
Title: ${opp.title}
Type: ${opp.type}
Value Sized: $${opp.valueSized?.toLocaleString() || 'Unknown'}
Recommendation: ${opp.recommendation}
Entity: ${opp.entity?.canonicalName || 'Unknown'}

ENTITY METRICS (all available):
${JSON.stringify(entityMetrics, null, 2)}

LINKED METRIC SLUGS (the specific metrics that triggered this opportunity):
${linkedMetricSlugs.join(', ') || 'See entity metrics above'}

Generate two sections:

1. DETAIL — A JSON object with these fields:
   - "why": 2-3 sentences of plain-English explanation of exactly what data pattern created this opportunity. Be specific with actual numbers from the metrics.
   - "numbers": Array of objects [{label: string, value: string, note?: string}] — 3-6 key metric values that directly support this opportunity. Include actual values from the data. Format numbers clearly (add %, $, etc).
   - "calcBasis": 1-2 sentences explaining how the dollar opportunity value was estimated (e.g., "Based on X patients × Y additional visits × $Z avg production per visit").

2. NEXT_STEPS — An array of 4-5 strings, each a specific, actionable step the practice manager should take. Be concrete: who does what, reference specific reports/tools/meetings.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "detail": {
    "why": "...",
    "numbers": [{"label": "...", "value": "...", "note": "..."}],
    "calcBasis": "..."
  },
  "nextSteps": ["Step 1...", "Step 2...", "Step 3...", "Step 4..."]
}`;

  try {
    const response = await anthropic.messages.create({
      model: (process.env.AI_MODEL || 'claude-sonnet-4-20250514') as Parameters<typeof anthropic.messages.create>[0]['model'],
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find((c) => c.type === 'text')?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON returned');

    const parsed = JSON.parse(jsonMatch[0]) as {
      detail: { why: string; numbers: Array<{ label: string; value: string; note?: string }>; calcBasis: string };
      nextSteps: string[];
    };

    const aiDetail = JSON.stringify(parsed.detail);
    const aiNextSteps = JSON.stringify(parsed.nextSteps);

    // Cache in DB
    await prisma.opportunity.update({
      where: { id: oppId },
      data: { aiDetail, aiNextSteps },
    });

    return NextResponse.json({ aiDetail, aiNextSteps });
  } catch (err) {
    console.error('[opportunity-detail] AI error:', err);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
