/** Disclose only the viewer's download capability. Keep session reads and recovery outside the React render. */
import { writeSealRecoveryIssue } from '@/infrastructure/logs/sealWorkerLog';
import { after } from 'next/server';
import { PollId, UserId } from '@/domain/seal/SealValues';
import { getCurrentUser } from '@/web/lib/session';
import { prisma } from '@/infrastructure/database/prisma';
import { PrismaSealPermissions } from '@/infrastructure/repositories/PrismaSealPermissions';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const poll = PollId.schema.safeParse((await params).pollId);

  if (!poll.success) {
    return new Response(null, { status: 404, headers });
  }

  if (new URL(request.url).searchParams.get('recover') === '1') {
    after(async () => {
      const { createSealRecovery } =
        await import('@/infrastructure/anchor/createSealRecovery');
      const result = await createSealRecovery(prisma).nudge(poll.data);

      if (!result.success) {
        await writeSealRecoveryIssue('page', {
          pollId: poll.data,
          operation: 'nudge',
          code: result.error,
        });
      }
    });
  }

  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ viewer: 'guest' }, { headers });
  }

  const viewer = UserId.schema.safeParse(user.id);

  if (!viewer.success) {
    return new Response(null, { status: 500, headers });
  }

  const access = await new PrismaSealPermissions(prisma).forViewer(
    poll.data,
    viewer.data
  );

  if (!access.success) {
    return new Response(null, { status: 503, headers });
  }

  return Response.json(
    { viewer: access.value.results ? 'sections' : 'signedIn' },
    { headers }
  );
}
