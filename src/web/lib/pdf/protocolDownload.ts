/** Shared authenticated HTTP boundary for results, named registers and signer PDFs.
 * Resolve the record before reading live inputs, then bind the footer to the selected document. */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { NextRequest } from 'next/server';
import { PollId, type UserId } from '@/domain/shared/EntityIds';
import type { Result } from '@/domain/shared/Result';
import type { ProtocolSource } from '@/application/seal/GetSealedProtocolUseCase';
import { resultsViewerAccess } from '@/web/lib/resultsViewerAccess';
import { getCurrentUser } from '@/web/lib/session';
import { defaultLocale, isValidLocale, type Locale } from '@/src/i18n/locales';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { sealFooter } from './sealFooter';
import { generatePdfBuffer } from './pollResultsPdfGenerator';
import en from '../../../../messages/en.json';
import ru from '../../../../messages/ru.json';

type Read<T> = (pollId: PollId, userId: UserId) => Promise<Result<T, string>>;
const catalogs = { en, ru };
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

async function refused(code: string, locale: Locale, status?: number) {
  const statuses: Record<string, number> = {
    'poll.errors.pollNotFound': 404,
    'common.errors.validationFailed': 400,
    'domain.poll.pollResultsAdminOnly': 403,
    'domain.poll.pollResultsNotOrgMember': 403,
    'domain.poll.pollIsAnonymous': 403,
    'domain.poll.pollProtocolNotAvailable': 403,
    'seal.errors.forbidden': 403,
  };

  return Response.json(
    { error: await translateErrorCode(code, { locale }) },
    { status: status ?? statuses[code] ?? 500, headers }
  );
}

export function protocolDownload<T extends { pollTitle: string }>(options: {
  filename: string;
  readSource: Read<ProtocolSource<T>>;
  readLive: Read<T>;
  build: (
    data: T,
    messages: typeof en,
    footer: Content
  ) => TDocumentDefinitions;
}) {
  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pollId: string }> }
  ) {
    const lang = request.nextUrl.searchParams.get('locale');
    const locale = lang && isValidLocale(lang) ? lang : defaultLocale;

    try {
      const user = await getCurrentUser();

      if (!user) {
        return refused('seal.errors.forbidden', locale, 401);
      }

      const access = await resultsViewerAccess(user);

      if (!access.success) {
        return refused(access.error.code, locale, access.error.status);
      }

      const decoded = PollId.safeParse((await params).pollId);

      if (!decoded.success) {
        return refused('common.errors.validationFailed', locale);
      }

      const pollId = decoded.data;
      let source = await options.readSource(pollId, user.id);

      if (!source.success) {
        return refused(source.error, locale);
      }

      let data: T;

      if (source.value.kind === 'sealed') {
        data = source.value.data;
      } else {
        const live = await options.readLive(pollId, user.id);

        if (!live.success) {
          return refused(live.error, locale);
        }

        // Sealing or access revocation may have completed during the live joins.
        source = await options.readSource(pollId, user.id);

        if (!source.success) {
          return refused(source.error, locale);
        }

        data = source.value.kind === 'sealed' ? source.value.data : live.value;
      }

      const messages = catalogs[locale];
      const evidence = sealFooter(source.value, pollId, locale, messages);
      const buffer = await generatePdfBuffer(
        options.build(data, messages, evidence)
      );
      const title =
        data.pollTitle.replace(/[^\p{L}\p{N}\s-]/gu, '').trim() || 'poll';
      const filename = title + '-' + options.filename;

      return new Response(new Uint8Array(buffer), {
        headers: {
          ...headers,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${options.filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    } catch (error) {
      console.error('Protocol PDF generation failed', error);

      return refused('common.errors.unexpected', locale);
    }
  };
}
