import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { uploads: true, entities: true, opportunities: true },
        },
      },
    });
    return NextResponse.json({ orgs });
  } catch (error) {
    console.error('[orgs GET]', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, industry } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const org = await prisma.organization.create({
      data: { name, industry },
    });
    return NextResponse.json({ org });
  } catch (error) {
    console.error('[orgs POST]', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
