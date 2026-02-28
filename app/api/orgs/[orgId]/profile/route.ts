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
    const profiles = await prisma.businessProfile.findMany({ where: { orgId: id } });
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('[profile GET]', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const id = parseInt(orgId);

  // Auth: only admin can update profiles
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const { type, content } = body;
    if (!type || !content) return NextResponse.json({ error: 'type and content required' }, { status: 400 });

    const profile = await prisma.businessProfile.upsert({
      where: { orgId_type: { orgId: id, type } },
      update: { content },
      create: { orgId: id, type, content },
    });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[profile POST]', error);
    return NextResponse.json({ error: 'Failed to upsert profile' }, { status: 500 });
  }
}
