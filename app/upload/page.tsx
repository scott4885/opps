import { prisma } from '@/lib/prisma';
import UploadClient from './UploadClient';

export const dynamic = 'force-dynamic';

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const sp = await searchParams;
  const orgId = sp.orgId ? parseInt(sp.orgId) : 1;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const orgName = org?.name ?? 'Organization';

  return <UploadClient orgId={orgId} orgName={orgName} />;
}
