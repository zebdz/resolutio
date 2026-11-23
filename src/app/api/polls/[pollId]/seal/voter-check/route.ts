/** Serve the hosted verifier's owner-only projection over HTTP. Keep database rows
 * and authorization reads outside React Flight, including its development diagnostics. */
import { canonical } from '@/domain/seal/Canonical';
import { PollId, UserId } from '@/domain/seal/SealValues';
import { PollId as ApplicationPollId } from '@/domain/shared/EntityIds';
import { prisma } from '@/infrastructure/database/prisma';
import { PrismaParticipantRepository } from '@/infrastructure/repositories/PrismaParticipantRepository';
import { PrismaUserModerationRepository } from '@/infrastructure/repositories/PrismaUserModerationRepository';
import { getUserModerationAccess } from '@/application/user/getUserModerationAccess';
import { getCurrentUser } from '@/web/lib/session';
import { sealExports } from '@/web/lib/sealDownload';

const participants = new PrismaParticipantRepository(prisma);
const moderation = new PrismaUserModerationRepository(prisma);
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

function denied(
  error: string,
  status: number,
  next?: '/login' | '/confirm-phone' | '/privacy-setup' | '/blocked'
) {
  return Response.json({ error, next }, { status, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return denied('seal.errors.forbidden', 401, '/login');
  }

  if (!user.isConfirmed()) {
    return denied('seal.errors.forbidden', 403, '/confirm-phone');
  }

  if (!user.privacySetupCompleted) {
    return denied('seal.errors.forbidden', 403, '/privacy-setup');
  }

  const access = await getUserModerationAccess(moderation, user.id);

  if (!access.success) {
    return denied(access.error, 500);
  }

  if (access.value === 'blocked') {
    return denied('seal.errors.forbidden', 403, '/blocked');
  }

  const poll = PollId.schema.safeParse((await params).pollId);
  const viewer = UserId.schema.safeParse(user.id);

  if (!poll.success || !viewer.success) {
    return denied('seal.errors.notFound', 404);
  }

  const own = await sealExports.myProof(poll.data, viewer.data);

  if (!own.success) {
    const status =
      own.error === 'seal.errors.notAVoter'
        ? 403
        : own.error === 'seal.errors.notFound'
          ? 404
          : 500;

    return denied(own.error, status);
  }

  const [timestamp, owner] = await Promise.all([
    sealExports.proof(poll.data),
    participants.getParticipantByUserAndPoll(
      ApplicationPollId.parse(poll.data),
      user.id
    ),
  ]);

  if (
    !timestamp.success &&
    timestamp.error !== 'seal.errors.anchorUnavailable'
  ) {
    return denied(timestamp.error, 500);
  }

  if (!owner.success) {
    return denied(owner.error, 500);
  }

  return Response.json(
    {
      bundle: canonical(own.value),
      proof: timestamp.success ? Array.from(timestamp.value.bytes) : null,
      storedCode: owner.value?.receiptSecret ?? null,
    },
    { headers }
  );
}
