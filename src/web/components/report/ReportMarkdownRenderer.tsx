'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { useTranslations } from 'next-intl';
import { detectVideoEmbed } from './detectVideoEmbed';
import { isAllowedAttachmentSrc } from './isAllowedAttachmentSrc';

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ['https', 'mailto'],
    src: ['https', '/'],
  },
};

interface Props {
  source: string;
  /**
   * Optional allowlist of attachment ids that belong to *this* report.
   * When provided, inline images whose src points to an attachment id not in
   * this set are treated like external images (placeholder instead of <img>).
   * Defense-in-depth: the save-time guard in Report.updateBody already
   * prevents new cross-report refs, but pre-existing bodies might still
   * carry stale URLs.
   */
  allowedAttachmentIds?: string[];
}

const ATTACHMENT_ID_FROM_SRC = /\/api\/report-attachments\/([A-Za-z0-9_-]+)/;

export function ReportMarkdownRenderer({
  source,
  allowedAttachmentIds,
}: Props) {
  const t = useTranslations('report.markdown');
  const allowedSet = allowedAttachmentIds
    ? new Set(allowedAttachmentIds)
    : null;

  return (
    <div className="prose prose-zinc max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
        skipHtml
        components={{
          a: ({ href, children, ...rest }) => {
            const v = href ? detectVideoEmbed(href) : null;

            if (v) {
              return (
                <iframe
                  src={v.embedUrl}
                  title={`${v.provider} video`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  className="aspect-video w-full rounded-md border border-zinc-200 dark:border-zinc-800"
                  allow="encrypted-media; picture-in-picture; web-share"
                />
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="cursor-pointer text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                {...rest}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            if (
              !src ||
              typeof src !== 'string' ||
              !isAllowedAttachmentSrc(src)
            ) {
              return (
                <span className="block rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs italic text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  {t('externalImageBlocked')}
                </span>
              );
            }

            // If the parent passed an allowlist, only render attachments that
            // belong to *this* report. Other ids → placeholder.
            if (allowedSet) {
              const m = src.match(ATTACHMENT_ID_FROM_SRC);
              const id = m?.[1];

              if (!id || !allowedSet.has(id)) {
                return (
                  <span className="block rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs italic text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    {t('externalImageBlocked')}
                  </span>
                );
              }
            }

            return (
              // eslint-disable-next-line @next/next/no-img-element -- src is a dynamic API route; next/image optimization doesn't apply
              <img
                src={src}
                alt={alt ?? ''}
                className="max-w-full rounded"
                loading="lazy"
              />
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
