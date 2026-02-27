import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const id = parseInt(orgId);
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
