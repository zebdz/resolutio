/** Saving a draft keeps failed files available for retry on the question that owns them. */
import { expect, it, vi } from 'vitest';
import { uploadQuestionFiles } from './questionFileUploads';

it('returns only the failed uploads, retaining file bytes and the persisted question ID', async () => {
  const first = { questionId: 'q1', file: new File(['a'], 'A.pdf') };
  const second = { questionId: 'q2', file: new File(['b'], 'B.pdf') };
  const send = vi
    .fn()
    .mockResolvedValueOnce({ id: 'saved' })
    .mockResolvedValueOnce({ error: 'Rejected' });
  expect(await uploadQuestionFiles([first, second], send)).toEqual([
    { ...second, error: 'Rejected' },
  ]);
  expect(send.mock.calls).toEqual([
    [first.file, 'q1'],
    [second.file, 'q2'],
  ]);
});
