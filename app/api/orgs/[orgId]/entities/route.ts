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
