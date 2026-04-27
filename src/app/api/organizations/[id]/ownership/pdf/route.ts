// PDF export endpoint for the org ownership view. Auth-gated to org admins
// and superadmins (matches the page itself). Re-runs the same query the
// table renders so the export reflects exactly what the user sees, with
// the active-only / owner-name / asset-name filters honored via query
// params. Filename includes the org name for filing.

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaPropertyAssetRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { isValidLocale, defaultLocale } from '@/src/i18n/locales';
import {
  buildOwnershipPdfDocumentDefinition,
  generateOwnershipPdfBuffer,
  OwnershipPdfGroup,
  OwnershipPdfInputData,
  OwnershipPdfTranslations,
} from '@/web/lib/pdf/ownershipPdfGenerator';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const propertyAssetRepository = new PrismaPropertyAssetRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

function loadTranslations(
  messages: Record<string, any>,
  prefix: string
): OwnershipPdfTranslations {
  const keys = prefix.split('.');
  let obj: any = messages;

  for (const k of keys) {
    obj = obj?.[k];
  }

  return obj as OwnershipPdfTranslations;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: organizationId } = await params;

    const isSuper = await userRepository.isSuperAdmin(user.id);
    const isAdmin =
      isSuper ||
      (await organizationRepository.isUserAdmin(user.id, organizationId));

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const activeOnly = sp.get('activeOnly') !== 'false'; // default true
    const ownerQuery = sp.get('ownerQuery') ?? undefined;
    const assetQuery = sp.get('assetQuery') ?? undefined;

    const localeParam = sp.get('locale');
    const locale =
      localeParam && isValidLocale(localeParam) ? localeParam : defaultLocale;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const rowsResult = await propertyAssetRepository.findOwnershipRows({
      organizationId,
      activeOnly,
      ownerQuery,
      assetQuery,
    });

    if (!rowsResult.success) {
      return NextResponse.json({ error: rowsResult.error }, { status: 500 });
    }

    // Group by asset to match the on-screen table's structure. Sort by
    // property → asset for predictable PDF output across exports.
    const groupMap = new Map<string, OwnershipPdfGroup>();

    for (const r of rowsResult.value) {
      const existing = groupMap.get(r.assetId);
      const ownerLabel = r.userLabel ?? r.externalOwnerLabel ?? r.userId ?? '';
      const row = {
        ownerLabel,
        sharePercent: r.share * 100,
        effectiveFrom: r.effectiveFrom.toISOString(),
        effectiveUntil: r.effectiveUntil
          ? r.effectiveUntil.toISOString()
          : null,
      };

      if (existing) {
        existing.rows.push(row);
      } else {
        groupMap.set(r.assetId, {
          propertyName: r.propertyName,
          assetName: r.assetName,
          rows: [row],
        });
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => {
      const byProp = a.propertyName.localeCompare(b.propertyName);

      return byProp !== 0 ? byProp : a.assetName.localeCompare(b.assetName);
    });

    const messagesPath = path.join(process.cwd(), 'messages', `${locale}.json`);
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
    const t = loadTranslations(messages, 'propertyAdmin.ownership.pdf');

    // Filter summary: human-readable so anyone reading the PDF later
    // understands which slice this represents. Include explicit "no filter"
    // wording when nothing is set so the absence is also documented.
    const filterParts: string[] = [];
    filterParts.push(activeOnly ? t.filterActive : t.filterAll);

    if (ownerQuery) {
      filterParts.push(`${t.owner}: "${ownerQuery}"`);
    }

    if (assetQuery) {
      filterParts.push(`${t.asset}: "${assetQuery}"`);
    }

    const filterSummary = filterParts.join(' · ');

    const pdfData: OwnershipPdfInputData = {
      organizationName: org?.name ?? '',
      generatedAt: new Date(),
      filterSummary,
      groups,
    };

    const docDefinition = buildOwnershipPdfDocumentDefinition(
      pdfData,
      t,
      locale
    );
    const pdfBuffer = await generateOwnershipPdfBuffer(docDefinition);

    const sanitizedOrg =
      (org?.name ?? '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim() ||
      'organization';
    const filename = `${sanitizedOrg}-ownership.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ownership.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error(
      'Ownership PDF generation error:',
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
    );

    return NextResponse.json(
      { error: 'common.errors.unexpected' },
      { status: 500 }
    );
  }
}
