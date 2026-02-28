import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const id = parseInt(orgId);

  // Auth: verify user is logged in and can access this org
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'member' && session.orgId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { orgId: id },
      orderBy: [{ priority: 'desc' }, { valueSized: 'desc' }],
      include: {
        entity: {
          include: {
            metricValues: {
              where: { isLatest: true },
              include: { metric: { select: { id: true, name: true, slug: true, unit: true, category: true } } },
            },
          },
        },
        metrics: { select: { id: true, name: true, slug: true, unit: true, category: true } },
      },
    });

    // Shape the response: for each opportunity, attach the metric values
    // for its linked metrics on its entity (for "Why this opportunity?" drill-down)
    const shaped = opportunities.map((opp) => {
      const entityMetricValues = opp.entity?.metricValues ?? [];
      // Only return metric values for slugs that are linked to this opportunity
      const linkedSlugs = new Set(opp.metrics.map((m) => m.slug));
      const whyMetrics = entityMetricValues
        .filter((mv) => linkedSlugs.has(mv.metric.slug))
        .map((mv) => ({
          name: mv.metric.name,
          slug: mv.metric.slug,
          unit: mv.metric.unit,
          category: mv.metric.category,
          value: mv.value,
        }));

      // If no linked metrics matched by slug, include all entity metrics as context
      const contextMetrics = whyMetrics.length > 0
        ? whyMetrics
        : entityMetricValues.slice(0, 8).map((mv) => ({
            name: mv.metric.name,
            slug: mv.metric.slug,
            unit: mv.metric.unit,
            category: mv.metric.category,
            value: mv.value,
          }));

      return {
        id: opp.id,
        title: opp.title,
        type: opp.type,
        priority: opp.priority,
        valueSized: opp.valueSized,
        recommendation: opp.recommendation,
        detail: opp.detail,
        nextSteps: opp.nextSteps,
        alternatives: opp.alternatives,
        entity: opp.entity
          ? { id: opp.entity.id, canonicalName: opp.entity.canonicalName, score: null }
          : null,
        whyMetrics: contextMetrics,
      };
    });

    // Fetch scores separately to attach to entities
    const scores = await prisma.opportunityScore.findMany({
      where: { entity: { orgId: id } },
      select: { entityId: true, score: true },
    });
    const scoreByEntityId = new Map(scores.map((s) => [s.entityId, s.score]));

    const withScores = shaped.map((opp) => ({
      ...opp,
      entity: opp.entity
        ? { ...opp.entity, score: scoreByEntityId.has(opp.entity.id) ? { score: scoreByEntityId.get(opp.entity.id)! } : null }
        : null,
    }));

    return NextResponse.json({ opportunities: withScores });
  } catch (error) {
    console.error('[opportunities GET]', error);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}
