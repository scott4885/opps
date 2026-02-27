import { NextResponse } from 'next/server';
import { runOpportunityEngine } from '@/lib/opportunity-engine';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    await runOpportunityEngine(parseInt(orgId));
    return NextResponse.json({ ok: true, message: 'Opportunity engine complete' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
