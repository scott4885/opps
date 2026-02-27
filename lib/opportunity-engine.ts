import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runOpportunityEngine(orgId: number) {
  // Get business profile
  const profiles = await prisma.businessProfile.findMany({ where: { orgId } });
  const profileText = profiles.map((p) => `## ${p.type}\n${p.content}`).join('\n\n');

  // Get all entities with their latest metric values
  const entities = await prisma.entity.findMany({
    where: { orgId },
    include: {
      metricValues: {
        where: { isLatest: true },
        include: { metric: true },
      },
    },
  });

  if (entities.length === 0) return;

  // Build entity summaries for AI
  const entitySummaries = entities.map((e) => ({
    id: e.id,
    name: e.canonicalName,
    type: e.entityType,
    metrics: e.metricValues.map((mv) => ({
      name: mv.metric.name,
      slug: mv.metric.slug,
      category: mv.metric.category,
      unit: mv.metric.unit,
      value: mv.value,
    })),
  }));

  const prompt = `You are an expert business analyst for Opps. — a business intelligence platform.

BUSINESS PROFILE:
${profileText}

ENTITY DATA (${entities.length} entities):
${JSON.stringify(entitySummaries, null, 2)}

Analyze this data and identify the TOP opportunities. Remember:
- Frame EVERYTHING positively — "unrealized value", "upside available", never "problem"
- Every opportunity MUST have a dollar value (valueSized) — estimate based on data if not explicit
- Each opportunity gets EXACTLY ONE recommended action (the best one)
- You may add 1-2 short alternatives in the alternatives array

Return a JSON array of opportunities (maximum 8, sorted by valueSized descending):
[
  {
    "entityId": 123,
    "type": "Revenue|Efficiency|Capacity|Cost|Retention",
    "title": "Short opportunity title",
    "valueSized": 847000,
    "recommendation": "One specific action to take right now",
    "alternatives": ["Alternative action 1", "Alternative action 2"],
    "priority": 1,
    "metricSlugs": ["relevant", "metric", "slugs"],
    "opportunityScore": 85
  }
]

Also return an opportunity score for each entity (0-100, higher = more opportunity available).

Return as:
{
  "opportunities": [...],
  "scores": [
    { "entityId": 123, "score": 84, "primaryType": "Revenue", "primaryValue": 847000 }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find((c) => c.type === 'text')?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Opportunity engine returned no JSON');
  const result = JSON.parse(jsonMatch[0]) as {
    opportunities: Array<{
      entityId?: number;
      type: string;
      title: string;
      valueSized?: number;
      recommendation: string;
      alternatives?: string[];
      priority?: number;
      metricSlugs?: string[];
    }>;
    scores: Array<{
      entityId: number;
      score: number;
      primaryType?: string;
      primaryValue?: number;
    }>;
  };

  // Clear existing opportunities and scores
  await prisma.opportunity.deleteMany({ where: { orgId } });
  await prisma.opportunityScore.deleteMany({ where: { entity: { orgId } } });

  // Get metrics by slug for relation linking
  const metrics = await prisma.metric.findMany({ where: { orgId } });
  const metricBySlug = new Map(metrics.map((m) => [m.slug, m]));

  // Write opportunities
  for (const opp of result.opportunities || []) {
    const metricIds = (opp.metricSlugs || [])
      .map((slug: string) => metricBySlug.get(slug))
      .filter(Boolean)
      .map((m) => ({ id: m!.id }));

    await prisma.opportunity.create({
      data: {
        orgId,
        entityId: opp.entityId || null,
        type: opp.type,
        title: opp.title,
        valueSized: opp.valueSized,
        recommendation: opp.recommendation,
        alternatives: opp.alternatives ? JSON.stringify(opp.alternatives) : null,
        priority: opp.priority || 0,
        metrics: { connect: metricIds },
      },
    });
  }

  // Write scores
  for (const s of result.scores || []) {
    await prisma.opportunityScore.upsert({
      where: { entityId: s.entityId },
      update: {
        score: s.score,
        primaryOpportunityType: s.primaryType,
        primaryValueSized: s.primaryValue,
        computedAt: new Date(),
      },
      create: {
        entityId: s.entityId,
        score: s.score,
        primaryOpportunityType: s.primaryType,
        primaryValueSized: s.primaryValue,
      },
    });
  }

  console.log(
    `[opportunity-engine] Wrote ${result.opportunities?.length || 0} opportunities, ${result.scores?.length || 0} scores for org ${orgId}`
  );
}
