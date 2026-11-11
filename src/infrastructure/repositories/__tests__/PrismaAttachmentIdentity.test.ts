/** Attachment persistence keeps caller-assigned identity/time and validates metadata.
 * Unknown stored values must fail before a trusted projection reaches application code. */
import { AttachmentFileName } from '@/domain/shared/attachments/AttachmentValues';
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PollAttachment } from '@/domain/poll/PollAttachment';
import { PollAttachmentId, PollId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaPollAttachmentRepository } from '../PrismaPollAttachmentRepository';

it('keeps the ID and time assigned to an uploaded attachment', async () => {
  const creation = testCreation(PollAttachmentId, 'file-1');
  const result = PollAttachment.createWithBytes(
    {
      pollId: PollId.parse('poll-1'),
      fileName: AttachmentFileName.parse('x.pdf'),
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-'),
    },
    creation
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const prisma = {
    pollAttachment: {
      create: vi.fn(async ({ data }) => ({
        id: 'db-generated',
        createdAt: new Date('2030-01-01'),
        ...data,
      })),
    },
  } as unknown as PrismaClient;
  const saved = await new PrismaPollAttachmentRepository(prisma).save(
    result.value,
    Buffer.from('%PDF-')
  );
  expect(saved.success && saved.value.id).toBe(creation.id);
  expect(saved.success && saved.value.createdAt).toBe(creation.now);
});

it('returns a stable failure for corrupt persisted metadata', async () => {
  const prisma = {
    pollAttachment: {
      findUnique: vi.fn(async () => ({
        id: 'file-1',
        pollId: 'poll-1',
        fileName: 'x.pdf',
        mimeType: 'application/exe',
        sizeBytes: 12,
        createdAt: new Date('2026-01-01'),
      })),
    },
  } as unknown as PrismaClient;
  expect(
    await new PrismaPollAttachmentRepository(prisma).findById(
      PollAttachmentId.parse('file-1')
    )
  ).toEqual({ success: false, error: 'common.errors.unexpected' });
});
