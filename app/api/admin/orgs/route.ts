import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, industry: true },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, industry } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const org = await prisma.organization.create({ data: { name, industry: industry || null } });
  return NextResponse.json(org, { status: 201 });
}
