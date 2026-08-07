// The use case owns the access decision (see PollResultsPolicy tests). What
// this pins is the WIRING: a refusal must surface as a 403 with no document
// built, never as a silently-served PDF.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';

const mockGetCurrentUser = vi.fn();
const mockExecute = vi.fn();
const mockBuildPdf = vi.fn();
const mockGeneratePdfBuffer = vi.fn();

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => code,
}));

vi.mock('@/application/poll/GetNamedProtocolUseCase', () => ({
  GetNamedProtocolUseCase: class {
    execute = mockExecute;
  },
}));

vi.mock('@/web/lib/pdf/namedProtocolPdfGenerator', () => ({
  buildNamedProtocolPdfDefinition: mockBuildPdf,
}));

vi.mock('@/web/lib/pdf/pollResultsPdfGenerator', () => ({
  generatePdfBuffer: mockGeneratePdfBuffer,
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {
    organization: { findUnique: vi.fn().mockResolvedValue({ name: 'ТСЖ' }) },
    board: { findUnique: vi.fn().mockResolvedValue(null) },
  },
  PrismaPollRepository: class {},
  PrismaParticipantRepository: class {},
  PrismaVoteRepository: class {},
  PrismaOrganizationRepository: class {},
  PrismaUserRepository: class {},
  PrismaPropertyAssetRepository: class {},
}));

const { GET } = await import('../route');

function makeRequest() {
  return {
    nextUrl: { searchParams: new URLSearchParams({ locale: 'ru' }) },
  } as unknown as NextRequest;
}

const params = () => Promise.resolve({ pollId: 'poll-1' });

function successValue(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    value: {
      poll: {
        id: 'poll-1',
        title: 'Бюджет',
        description: 'Описание',
        organizationId: 'org-1',
        boardId: null,
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-02-15'),
        distributionType: 'EQUAL',
        isActive: () => false,
        isOpen: () => false,
        ...((overrides.poll as object) ?? {}),
      },
      register: [],
      questions: [],
      totalParticipants: 0,
      totalParticipantWeight: 0,
    },
  };
}

describe('GET /api/polls/[pollId]/results/named-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBuildPdf.mockReturnValue({ content: [] });
    mockGeneratePdfBuffer.mockResolvedValue(Buffer.from('pdf'));
  });

  it('401s an anonymous visitor without touching the use case', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeRequest(), { params: params() });

    expect(response.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('403s when the poll is anonymous, without building a document', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: PollDomainCodes.POLL_IS_ANONYMOUS,
    });

    const response = await GET(makeRequest(), { params: params() });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: PollDomainCodes.POLL_IS_ANONYMOUS,
    });
    expect(mockBuildPdf).not.toHaveBeenCalled();
    expect(mockGeneratePdfBuffer).not.toHaveBeenCalled();
  });

  it('403s a viewer who may not read voter names', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: PollDomainCodes.POLL_RESULTS_ADMIN_ONLY,
    });

    const response = await GET(makeRequest(), { params: params() });

    expect(response.status).toBe(403);
    expect(mockBuildPdf).not.toHaveBeenCalled();
  });

  it('serves the PDF when the use case allows it', async () => {
    mockExecute.mockResolvedValue(successValue());

    const response = await GET(makeRequest(), { params: params() });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(mockBuildPdf).toHaveBeenCalledTimes(1);
  });

  it('marks the document preliminary while the poll is still active', async () => {
    mockExecute.mockResolvedValue(
      successValue({ poll: { isActive: () => true } })
    );

    await GET(makeRequest(), { params: params() });

    expect(mockBuildPdf.mock.calls[0][0].isPreliminary).toBe(true);
  });

  it('flags a property-based poll so the register gets its holdings column', async () => {
    mockExecute.mockResolvedValue(
      successValue({ poll: { distributionType: 'OWNERSHIP_SIZE_WEIGHTED' } })
    );

    await GET(makeRequest(), { params: params() });

    expect(mockBuildPdf.mock.calls[0][0].isPropertyBased).toBe(true);
  });

  it('leaves an EQUAL poll without a holdings column', async () => {
    mockExecute.mockResolvedValue(successValue());

    await GET(makeRequest(), { params: params() });

    expect(mockBuildPdf.mock.calls[0][0].isPropertyBased).toBe(false);
  });

  it('resolves size-unit labels for the requested locale', async () => {
    mockExecute.mockResolvedValue(successValue());

    await GET(makeRequest(), { params: params() });

    const t = mockBuildPdf.mock.calls[0][1];

    expect(t.sizeUnits['propertyAdmin.sizeUnit.squareMeters']).toBe('м²');
    expect(t.title).toBe('ПОИМЁННЫЙ ПРОТОКОЛ');
  });
});
