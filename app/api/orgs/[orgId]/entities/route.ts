import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const id = parseInt(orgId);
  try {
    const entities = await prisma.entity.findMany({
      where: { orgId: id },
      include: {
        score: true,
        metricValues: {
          where: { isLatest: true },
          include: {
            metric: { select: { id: true, name: true, slug: true, unit: true, category: true } },
            upload: { select: { id: true, filename: true, uploadedAt: true } },
          },
        },
        opportunities: {
          orderBy: { valueSized: 'desc' },
          take: 1,
        },
      },
      orderBy: { canonicalName: 'asc' },
    });
    return NextResponse.json({ entities });
  } catch (error) {
    console.error('[entities GET]', error);
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }
}
