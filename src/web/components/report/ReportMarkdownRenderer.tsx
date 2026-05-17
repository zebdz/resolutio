'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
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
}

export function ReportMarkdownRenderer({ source }: Props) {
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
              return null;
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
