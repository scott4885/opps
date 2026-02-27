import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 15;

async function callOpportunityAI(
  profileText: string,
  entitySummaries: Array<{
    id: number;
    name: string;
    type: string;
    metrics: Array<{ name: string; slug: string; category: string | null; unit: string | null; value: number }>;
  }>
) {
  const prompt = `You are an expert business analyst for Opps. — a business intelligence platform.

BUSINESS PROFILE:
${profileText}

ENTITY DATA (${entitySummaries.length} entities):
${JSON.stringify(entitySummaries, null, 2)}

Analyze this data and identify ALL high-value opportunities for EVERY entity in the list above. Rules:
- You MUST return at least one opportunity for each entity that has meaningful metrics
- Frame EVERYTHING positively — "unrealized value", "upside available", never "problem"
- Every opportunity MUST have a dollar value (valueSized) — estimate based on data if not explicit
- Each opportunity gets EXACTLY ONE recommended action (the best one)
- You may add 1-2 short alternatives in the alternatives array

Return a JSON object with:
1. opportunities — one or more per entity, sorted by valueSized descending
2. scores — one score per entity (0–100, higher = more opportunity available)

{
  "opportunities": [
    {
      "entityId": 123,
      "type": "Revenue|Efficiency|Capacity|Cost|Retention",
      "title": "Short opportunity title",
      "valueSized": 847000,
      "recommendation": "One specific action to take right now",
      "alternatives": ["Alternative action 1", "Alternative action 2"],
      "priority": 1,
      "metricSlugs": ["relevant", "metric", "slugs"]
    }
  ],
  "scores": [
    { "entityId": 123, "score": 84, "primaryType": "Revenue", "primaryValue": 847000 }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find((c) => c.type === 'text')?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Opportunity AI returned no JSON');
  return JSON.parse(jsonMatch[0]) as {
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
}

export async function runOpportunityEngine(orgId: number) {
  // Get business profile
  const profiles = await prisma.businessProfile.findMany({ where: { orgId } });
  const profileText = profiles.map((p) => `## ${p.type}\n${p.content}`).join('\n\n');

  // Get all entities with their latest metric values
  const allEntities = await prisma.entity.findMany({
    where: { orgId },
    include: {
      metricValues: {
        where: { isLatest: true },
        include: { metric: true },
      },
    },
  });

  // Only process entities that have metric data
  const entitiesWithData = allEntities.filter((e) => e.metricValues.length > 0);

  if (entitiesWithData.length === 0) return;

  // Clear existing opportunities and scores first
  await prisma.opportunity.deleteMany({ where: { orgId } });
  await prisma.opportunityScore.deleteMany({ where: { entity: { orgId } } });

  // Get metrics by slug for relation linking
  const metrics = await prisma.metric.findMany({ where: { orgId } });
  const metricBySlug = new Map(metrics.map((m) => [m.slug, m]));

  // Process entities in batches of BATCH_SIZE
  const allOpportunities: Array<{
    entityId?: number;
    type: string;
    title: string;
    valueSized?: number;
    recommendation: string;
    alternatives?: string[];
    priority?: number;
    metricSlugs?: string[];
  }> = [];

  const allScores: Array<{
    entityId: number;
    score: number;
    primaryType?: string;
    primaryValue?: number;
  }> = [];

  for (let i = 0; i < entitiesWithData.length; i += BATCH_SIZE) {
    const batch = entitiesWithData.slice(i, i + BATCH_SIZE);

    const entitySummaries = batch.map((e) => ({
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

    try {
      console.log(
        `[opportunity-engine] Processing batch ${i + 1}–${Math.min(i + BATCH_SIZE, entitiesWithData.length)} of ${entitiesWithData.length}`
      );
      const result = await callOpportunityAI(profileText, entitySummaries);
      allOpportunities.push(...(result.opportunities || []));
      allScores.push(...(result.scores || []));
    } catch (err) {
      console.error(`[opportunity-engine] Batch ${i}–${i + BATCH_SIZE} failed:`, err);
    }
  }

  // Write all opportunities
  for (const opp of allOpportunities) {
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
  for (const s of allScores) {
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
    `[opportunity-engine] Done — ${allOpportunities.length} opportunities, ${allScores.length} scores for ${entitiesWithData.length} entities (${Math.ceil(entitiesWithData.length / BATCH_SIZE)} batches)`
  );
}
