/** Shared HTTP boundary for local evidence downloads. Private endpoints derive identity
 * solely from the server session. All downloadable JSON preserves committed text bytes. */
import { getCurrentUser } from '@/web/lib/session';
import { SealExports } from '@/application/seal/SealExports';
import { PrismaSealReader } from '@/infrastructure/repositories/PrismaSealReader';
import { PrismaSealPermissions } from '@/infrastructure/repositories/PrismaSealPermissions';
import { prisma } from '@/infrastructure/database/prisma';
import { PollId, UserId } from '@/domain/seal/SealValues';
import { canonical } from '@/domain/seal/Canonical';

export const sealExports = new SealExports(
  new PrismaSealReader(prisma),
  new PrismaSealPermissions(prisma)
);
export type SealDownload = 'manifest' | 'proof' | 'sections' | 'my-proof';
type Context = { params: Promise<{ pollId: string }> };

function refused(error: string) {
  const status =
    error === 'seal.errors.notFound' ||
    error === 'seal.errors.anchorUnavailable'
      ? 404
      : error === 'seal.errors.forbidden' || error === 'seal.errors.notAVoter'
        ? 403
        : 500;

  return Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

function file(body: BodyInit, name: string, type: string, status?: string) {
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': 'attachment; filename="' + name + '"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status ? { 'X-Seal-Anchor': status } : {}),
    },
  });
}

export function sealDownload(kind: SealDownload) {
  return async function GET(
    _request: Request,
    { params }: Context
  ): Promise<Response> {
    const id = PollId.schema.safeParse((await params).pollId);

    if (!id.success) {
      return refused('seal.errors.notFound');
    }

    const poll = id.data;

    if (kind === 'manifest') {
      const result = await sealExports.publicRecord(poll);

      return result.success
        ? file(result.value.manifest, 'manifest.json', 'application/json')
        : refused(result.error);
    }

    if (kind === 'proof') {
      const result = await sealExports.proof(poll);

      return result.success
        ? file(
            new Uint8Array(result.value.bytes),
            poll + '.ots',
            'application/octet-stream',
            result.value.status
          )
        : refused(result.error);
    }

    const user = await getCurrentUser();

    if (!user) {
      return refused('seal.errors.forbidden');
    }

    const viewer = UserId.schema.safeParse(user.id);

    if (!viewer.success) {
      return refused('seal.errors.forbidden');
    }

    const result =
      kind === 'sections'
        ? await sealExports.sections(poll, viewer.data)
        : await sealExports.myProof(poll, viewer.data);

    return result.success
      ? file(
          canonical(result.value),
          kind === 'sections' ? 'sections.json' : 'bundle.json',
          'application/json'
        )
      : refused(result.error);
  };
}
