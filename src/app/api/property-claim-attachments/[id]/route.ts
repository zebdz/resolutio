// Authenticated download route for proof-of-ownership uploads. Streams the
// raw bytes from Postgres bytea with the original filename. Authorisation
// rule: only the claimant, an org admin, or a superadmin may download.
//
// Why a route handler instead of a server action? Server actions return JSON
// (or a structured value); this needs binary content with custom headers
// (Content-Type matched to the stored mimeType, Content-Disposition with
// the original filename). Route handlers serve that natively via Response.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaPropertyClaimRepository,
  PrismaPropertyClaimAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';

const claimRepository = new PrismaPropertyClaimRepository(prisma);
const attachmentRepository = new PrismaPropertyClaimAttachmentRepository(
  prisma
);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Pull metadata first to do the auth check; only fetch bytes once we
  // know the caller is allowed to receive them.
  const bytesResult = await attachmentRepository.findBytesById(id);

  if (!bytesResult.success || !bytesResult.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Resolve which claim this attachment belongs to via a lightweight query
  // — we already trust the metadata table to guard the relation.
  const meta = await prisma.propertyClaimAttachment.findUnique({
    where: { id },
    select: { claimId: true },
  });

  if (!meta) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const claimRes = await claimRepository.findById(meta.claimId);

  if (!claimRes.success || !claimRes.value) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const claim = claimRes.value;

  const isClaimant = claim.userId === user.id;
  const isSuper = await userRepository.isSuperAdmin(user.id);
  const isAdmin =
    !isSuper &&
    (await organizationRepository.isUserAdmin(user.id, claim.organizationId));

  if (!isClaimant && !isAdmin && !isSuper) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { fileName, mimeType, bytes } = bytesResult.value;
  // Encode the filename for Content-Disposition (RFC 5987) so non-ASCII
  // names (Russian, etc.) survive the round trip.
  const encoded = encodeURIComponent(fileName).replace(
    /['()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16)
  );

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-store',
      // Defense-in-depth: if a browser renders the file inline despite the
      // attachment Content-Disposition (some PDF viewer extensions do this),
      // CSP sandbox neutralizes any embedded scripts / forms / popups in the
      // response. Has no effect once the file is downloaded and opened in
      // a native viewer — pair with the trust-on-display warning in the UI.
      'Content-Security-Policy':
        "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
