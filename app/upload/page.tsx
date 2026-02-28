import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import UploadClient from './UploadClient';

export const dynamic = 'force-dynamic';

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) redirect('/login');

  const sp = await searchParams;
  // Admin can pass explicit orgId; otherwise use session
  const orgId = (session.role === 'admin' && sp.orgId) ? parseInt(sp.orgId) : (session.orgId ?? 1);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const orgName = org?.name ?? 'Organization';

  return <UploadClient orgId={orgId} orgName={orgName} />;
}
