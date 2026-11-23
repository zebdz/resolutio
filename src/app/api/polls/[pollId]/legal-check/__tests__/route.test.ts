/** Legal-check HTTP failures stop before provider calls and preserve error status semantics.
 * Configuration/storage failures are server errors rather than invalid user requests. */
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AIErrors } from '@/application/ai/AIErrors';
const mocks = vi.hoisted(() => ({ validate: vi.fn(), generate: vi.fn() }));
vi.mock('@/application/ai/AnalyzePollLegalityUseCase', () => ({
  AnalyzePollLegalityUseCase: class {
    validate = mocks.validate;
  },
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaPollRepository: class {},
  PrismaOrganizationRepository: class {},
  PrismaUserRepository: class {
    async isSuperAdmin() {
      return false;
    }
  },
}));
vi.mock('@/infrastructure/ai/AIProviderAdapter', () => ({
  AIProviderAdapter: class {},
  AVAILABLE_MODELS: ['deepseek'],
}));
vi.mock('@/infrastructure/ai/AILogger', () => ({ AILogger: class {} }));
vi.mock('ai', () => ({
  generateText: mocks.generate,
  Output: { object: vi.fn() },
}));
vi.mock('@/web/lib/session', () => ({
  getCurrentUser: async () => ({ id: 'user-1' }),
}));
vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: async () => null,
}));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
const { POST } = await import('../route');
beforeEach(() => {
  vi.clearAllMocks();
});
it.each([
  { error: 'common.errors.unexpected', status: 500 },
  { error: 'common.errors.validationFailed', status: 400 },
  { error: AIErrors.RATE_LIMIT_EXCEEDED, status: 429 },
  { error: AIErrors.NOT_ADMIN, status: 403 },
  { error: AIErrors.POLL_NOT_FOUND, status: 404 },
])(
  'returns $status for $error without calling the provider',
  async ({ error, status }) => {
    mocks.validate.mockResolvedValue({ success: false, error });
    const request = new NextRequest(
      'http://localhost/api/polls/poll-1/legal-check',
      { method: 'POST', body: JSON.stringify({ model: 'deepseek' }) }
    );
    const response = await POST(request, {
      params: Promise.resolve({ pollId: 'poll-1' }),
    });

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: `translated:${error}` });
    expect(mocks.generate).not.toHaveBeenCalled();
  }
);
