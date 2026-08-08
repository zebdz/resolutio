import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { GetNamedProtocolUseCase } from '@/application/poll/GetNamedProtocolUseCase';
import { User } from '@/domain/user/User';
import {
  DistributionType,
  isOwnershipMode,
} from '@/domain/poll/DistributionType';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
  PrismaPropertyAssetRepository,
} from '@/infrastructure/index';
import { isValidLocale, defaultLocale } from '@/src/i18n/locales';
import {
  buildNamedProtocolPdfDefinition,
  NamedProtocolPdfInput,
  NamedProtocolPdfTranslations,
} from '@/web/lib/pdf/namedProtocolPdfGenerator';
import { generatePdfBuffer } from '@/web/lib/pdf/pollResultsPdfGenerator';

const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const propertyAssetRepository = new PrismaPropertyAssetRepository(prisma);

const getNamedProtocolUseCase = new GetNamedProtocolUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository,
  propertyAssetRepository
);

function loadTranslations(
  messages: Record<string, any>,
  prefix: string
): Omit<NamedProtocolPdfTranslations, 'sizeUnits'> {
  const keys = prefix.split('.');
  let obj: any = messages;

  for (const k of keys) {
    obj = obj?.[k];
  }

  return obj as Omit<NamedProtocolPdfTranslations, 'sizeUnits'>;
}

// 'squareMeters' → 'propertyAdmin.sizeUnit.squareMeters' → 'м²'. The generator
// is handed a flat lookup so it never has to know about next-intl.
function flattenSizeUnits(
  messages: Record<string, any>
): Record<string, string> {
  const units = (messages?.propertyAdmin?.sizeUnit ?? {}) as Record<
    string,
    string
  >;

  return Object.fromEntries(
    Object.entries(units).map(([key, label]) => [
      `propertyAdmin.sizeUnit.${key}`,
      label,
    ])
  );
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

    // 2. Build the named protocol. The use case runs PollResultsPolicy —
    // it refuses anonymous polls and anyone who may not read voter names, so
    // there is deliberately no second permission check here.
    const result = await getNamedProtocolUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: await translateErrorCode(result.error) },
        { status: 403 }
      );
    }

    const {
      poll,
      register,
      questions,
      totalParticipants,
      totalParticipantWeight,
    } = result.value;

    // 3. Fetch org + board names
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

    // 4. Load translations for the requested locale
    const localeParam = request.nextUrl.searchParams.get('locale');
    const locale =
      localeParam && isValidLocale(localeParam) ? localeParam : defaultLocale;
    const messagesPath = path.join(process.cwd(), 'messages', `${locale}.json`);
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
    const t: NamedProtocolPdfTranslations = {
      ...loadTranslations(messages, 'poll.results.namedPdf'),
      sizeUnits: flattenSizeUnits(messages),
    };

    // 5. Flatten the read model into the generator's input
    const pdfData: NamedProtocolPdfInput = {
      organizationName: org?.name ?? '',
      boardName,
      pollTitle: poll.title ?? '',
      pollDescription: stripMarkdownToPlainText(poll.description ?? ''),
      startDate: poll.startDate
        ? poll.startDate.toISOString().split('T')[0]
        : '',
      endDate: poll.endDate ? poll.endDate.toISOString().split('T')[0] : '',
      // A poll that is still running produces an interim document.
      isPreliminary: poll.isActive(),
      isPropertyBased: isOwnershipMode(
        poll.distributionType as DistributionType
      ),
      isOpenPoll: poll.isOpen(),
      totalParticipants,
      totalParticipantWeight,
      register: register.map((person) => ({
        userId: person.userId,
        fullName: User.formatFullName(
          person.firstName,
          person.lastName,
          person.middleName
        ),
        weight: person.weight,
        holdings: person.holdings.map((h) => ({
          propertyName: h.propertyName,
          assetName: h.assetName,
          size: h.size,
          sizeUnitKey: h.sizeUnitKey,
          share: h.share,
        })),
      })),
      questions: questions.map((q) => ({
        questionText: q.questionText ?? '',
        questionDetails: q.questionDetails,
        questionType: q.questionType,
        totalVotes: q.totalVotes,
        totalWeight: q.totalWeight,
        answers: q.answers.map((a) => ({
          answerText: a.answerText ?? '',
          voteCount: a.voteCount,
          totalWeight: a.totalWeight,
          percentage: a.percentage,
          voters: a.voters.map((v) => ({
            userId: v.userId,
            weight: v.weight,
          })),
        })),
        nonVoterIds: q.nonVoterIds,
      })),
    };

    // 6. Generate PDF
    const docDefinition = buildNamedProtocolPdfDefinition(pdfData, t);
    const pdfBuffer = await generatePdfBuffer(docDefinition);

    // 7. Return PDF response
    // Keep letters (incl Cyrillic), digits, spaces, hyphens
    const sanitizedTitle =
      (poll.title ?? '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim() || 'poll';
    const filename = `${sanitizedTitle}-named-protocol.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="named-protocol.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error(
      'Named protocol PDF generation error:',
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
