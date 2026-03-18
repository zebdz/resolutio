import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import { isValidLocale, defaultLocale } from '@/src/i18n/locales';
import {
  buildProtocolSignersPdfDefinition,
  ProtocolSignersPdfTranslations,
} from '@/web/lib/pdf/protocolSignersPdfGenerator';
import { generatePdfBuffer } from '@/web/lib/pdf/pollResultsPdfGenerator';

const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

const getPollResultsUseCase = new GetPollResultsUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository
);

function loadTranslations(
  messages: Record<string, any>,
  prefix: string
): ProtocolSignersPdfTranslations {
  const keys = prefix.split('.');
  let obj: any = messages;

  for (const k of keys) {
    obj = obj?.[k];
  }

  return obj as ProtocolSignersPdfTranslations;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    // 1. Auth check
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pollId } = await params;

    // 2. Fetch poll results (includes admin check)
    const result = await getPollResultsUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: await translateErrorCode(result.error) },
        { status: 403 }
      );
    }

    const { poll, protocolSignWillingness, canViewVoters } = result.value;

    // 3. Only admins can export protocol PDF
    if (!canViewVoters) {
      return NextResponse.json(
        { error: 'poll.errors.resultsAdminOnly' },
        { status: 403 }
      );
    }

    // 4. Fetch org + board names
    const org = await prisma.organization.findUnique({
      where: { id: poll.organizationId },
      select: { name: true },
    });

    let boardName: string | null = null;

    if (poll.boardId) {
      const board = await prisma.board.findUnique({
        where: { id: poll.boardId },
        select: { name: true },
      });
      boardName = board?.name ?? null;
    }

    // 6. Load translations
    const localeParam = request.nextUrl.searchParams.get('locale');
    const locale =
      localeParam && isValidLocale(localeParam) ? localeParam : defaultLocale;
    const messagesPath = path.join(process.cwd(), 'messages', `${locale}.json`);
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
    const t = loadTranslations(messages, 'poll.results.protocolPdf');

    // 7. Build PDF
    const docDefinition = buildProtocolSignersPdfDefinition(
      {
        organizationName: org?.name ?? '',
        boardName,
        pollTitle: poll.title ?? '',
        entries: protocolSignWillingness.map((entry) => ({
          firstName: entry.firstName,
          lastName: entry.lastName,
          middleName: entry.middleName,
          willingToSignProtocol: entry.willingToSignProtocol,
        })),
      },
      t
    );

    const pdfBuffer = await generatePdfBuffer(docDefinition);

    // 8. Return PDF
    const sanitizedTitle =
      (poll.title ?? '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim() || 'poll';
    const filename = `${sanitizedTitle}-protocol-signers.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="protocol-signers.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error(
      'Protocol PDF generation error:',
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
