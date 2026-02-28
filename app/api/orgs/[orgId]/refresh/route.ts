import { NextResponse } from 'next/server';
import { runOpportunityEngine } from '@/lib/opportunity-engine';
import { getSession } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const id = parseInt(orgId);

  // Auth: verify user is logged in and can access this org
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'member' && session.orgId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await runOpportunityEngine(parseInt(orgId));
    return NextResponse.json({ ok: true, message: 'Opportunity engine complete' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
