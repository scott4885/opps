import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const id = parseInt(orgId);
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { orgId: id },
      orderBy: [{ priority: 'desc' }, { valueSized: 'desc' }],
      include: {
        entity: true,
        metrics: { select: { id: true, name: true, slug: true, unit: true } },
      },
    });
    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error('[opportunities GET]', error);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}
