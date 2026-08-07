import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createTranslator } from 'next-intl';
import { z } from 'zod';

const ru = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'messages', 'ru.json'), 'utf-8')
);

// The util reaches for request-scoped translations. Swap in a real translator
// over the real message catalogue so the assertions exercise actual ICU
// formatting rather than a stub that cannot fail the way production does.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: 'ru',
      messages: ru,
      namespace,
      onError: () => {},
    }),
}));

const { translateZodFieldErrors } = await import('../translateZodErrors');

const { createPollSchema } = await import('@/application/poll/PollSchemas');
const { POLL_DESCRIPTION_MAX_LENGTH, POLL_TITLE_MAX_LENGTH } =
  await import('@/domain/poll/Poll');
const { UpdateUserProfileSchema } =
  await import('@/src/application/user/UpdateUserProfileSchema');
const { NICKNAME_MIN_LENGTH, NICKNAME_MAX_LENGTH } =
  await import('@/domain/user/Nickname');

const noopProfanityChecker = {
  containsProfanity: () => false,
  findProfaneWords: () => [],
};

function issuesFor(schema: z.ZodTypeAny, input: unknown): z.ZodIssue[] {
  const result = schema.safeParse(input);

  if (result.success) {
    throw new Error('expected the input to fail validation');
  }

  return result.error.issues;
}

const validPollInput = {
  title: 'Обычное название',
  description: 'Обычное описание',
  organizationId: 'org-1',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-02-01T00:00:00.000Z',
};

describe('translateZodFieldErrors — limit parameters', () => {
  it('fills maxLength for a too-long poll description', async () => {
    const issues = issuesFor(createPollSchema(noopProfanityChecker as any), {
      ...validPollInput,
      description: 'я'.repeat(POLL_DESCRIPTION_MAX_LENGTH + 1),
    });

    const fieldErrors = await translateZodFieldErrors(issues);

    expect(fieldErrors.description[0]).toBe(
      `Описание голосования не может превышать ${POLL_DESCRIPTION_MAX_LENGTH} символов`
    );
  });

  it('fills maxLength for a too-long poll title', async () => {
    const issues = issuesFor(createPollSchema(noopProfanityChecker as any), {
      ...validPollInput,
      title: 'я'.repeat(POLL_TITLE_MAX_LENGTH + 1),
    });

    const fieldErrors = await translateZodFieldErrors(issues);

    expect(fieldErrors.title[0]).toBe(
      `Название голосования не может превышать ${POLL_TITLE_MAX_LENGTH} символов`
    );
  });

  it('never leaves a raw ICU placeholder or a bare domain code', async () => {
    const issues = issuesFor(createPollSchema(noopProfanityChecker as any), {
      ...validPollInput,
      description: 'я'.repeat(POLL_DESCRIPTION_MAX_LENGTH + 1),
    });

    const message = (await translateZodFieldErrors(issues)).description[0];

    expect(message).not.toContain('{maxLength}');
    expect(message).not.toMatch(/^domain\./);
  });

  it('still honours params passed explicitly by the caller', async () => {
    const issues = issuesFor(UpdateUserProfileSchema, {
      userId: 'test',
      nickname: 'ab',
    });

    const fieldErrors = await translateZodFieldErrors(issues, {
      minLength: NICKNAME_MIN_LENGTH,
      maxLength: NICKNAME_MAX_LENGTH,
    });

    expect(fieldErrors.nickname[0]).toContain(String(NICKNAME_MIN_LENGTH));
    expect(fieldErrors.nickname[0]).toContain(String(NICKNAME_MAX_LENGTH));
  });

  it('covers every parameterized domain message in the params table', async () => {
    const { ERROR_CODE_PARAMS } = await import('../errorCodeParams');

    // Supplied at throw time via the ?words= suffix that translateErrorCode
    // parses, so it deliberately has no static entry.
    const DYNAMICALLY_SUPPLIED = ['domain.shared.containsProfanityWithWords'];

    const parameterized: Array<{ code: string; placeholders: string[] }> = [];

    const walk = (node: unknown, pathParts: string[]): void => {
      if (typeof node === 'string') {
        const placeholders = [...node.matchAll(/\{(\w+)[,}]/g)].map(
          (m) => m[1]
        );

        if (placeholders.length > 0) {
          parameterized.push({
            code: pathParts.join('.'),
            placeholders: [...new Set(placeholders)],
          });
        }

        return;
      }

      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          walk(value, [...pathParts, key]);
        }
      }
    };

    walk(ru.domain, ['domain']);

    expect(parameterized.length).toBeGreaterThan(0);

    const missing = parameterized
      .filter(({ code }) => !DYNAMICALLY_SUPPLIED.includes(code))
      .flatMap(({ code, placeholders }) =>
        placeholders
          .filter((p) => ERROR_CODE_PARAMS[code]?.[p] === undefined)
          .map((p) => `${code} is missing {${p}}`)
      );

    expect(missing).toEqual([]);
  });

  it('passes non-domain messages through untouched', async () => {
    const issues: z.ZodIssue[] = [
      {
        code: 'custom',
        path: ['endDate'],
        message: 'Start date must be before end date',
      } as z.ZodIssue,
    ];

    const fieldErrors = await translateZodFieldErrors(issues);

    expect(fieldErrors.endDate[0]).toBe('Start date must be before end date');
  });
});
