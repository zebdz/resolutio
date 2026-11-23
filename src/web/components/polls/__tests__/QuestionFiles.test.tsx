/** Readers can preview supported question evidence while keeping its authorized download link. */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { QuestionFiles } from '../QuestionFiles';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, args?: { name: string }) =>
    args ? 'Preview ' + args.name : key,
}));

it('offers an image preview using the stored MIME type even for an extensionless filename', () => {
  const files = [{ id: 'photo', fileName: 'site plan', mimeType: 'image/png' }];
  const html = renderToStaticMarkup(<QuestionFiles files={files} />);
  expect(html).toContain('aria-label="Preview site plan"');
  expect(html).toContain('<img');
  expect(html).toContain('href="/api/poll-attachments/photo"');
});

it('shows a PDF-labelled first-page preview and an independent original download', () => {
  const files = [
    { id: 'plans', fileName: 'plans.pdf', mimeType: 'application/pdf' },
  ];
  const html = renderToStaticMarkup(<QuestionFiles files={files} />);
  expect(html).toContain('<canvas');
  expect(html).toContain('>PDF<');
  expect(html).toContain('href="/api/poll-attachments/plans"');
});

it('keeps the download when the MIME type cannot be previewed, even with a PDF filename', () => {
  const files = [
    {
      id: 'unknown',
      fileName: 'notes.pdf',
      mimeType: 'application/octet-stream',
    },
  ];
  const html = renderToStaticMarkup(<QuestionFiles files={files} />);
  expect(html).not.toContain('<button');
  expect(html).toContain('href="/api/poll-attachments/unknown"');
});
