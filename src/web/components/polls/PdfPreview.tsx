'use client';

/** Draw PDF pages on canvas using a same-origin worker. Only thumbnails near the
 * viewport load a document, and release its bytes once the first page is painted. */
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFWorker, RenderTask } from 'pdfjs-dist';
import { useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';

// The installed, version-matched browser builds are served as static files.
const browserModule = '/pdfjs/pdf.min.mjs';
let sharedWorker: PDFWorker | undefined;

export function PdfPreview({
  source,
  expanded = false,
}: {
  source: string | File;
  expanded?: boolean;
}) {
  const t = useTranslations('poll.attachments');
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{
    source: string | File;
    document: PDFDocumentProxy;
  } | null>(null);
  const pdf = loaded?.source === source ? loaded.document : null;
  const [page, setPage] = useState(1);
  const [failedSource, setFailed] = useState<string | File | null>(null);
  const failed = failedSource === source;

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;

    if (canvas.current) {
      canvas.current.width = 1;
    }

    async function load() {
      try {
        const {
          getDocument,
          GlobalWorkerOptions,
          PDFWorker,
          version,
        }: typeof import('pdfjs-dist') = await import(
          /* webpackIgnore: true */ /* turbopackIgnore: true */ browserModule
        );
        const input =
          typeof source === 'string'
            ? { url: source }
            : { data: await source.arrayBuffer() };

        if (cancelled) {
          return;
        }

        GlobalWorkerOptions.workerSrc =
          '/pdfjs/pdf.worker.min.mjs?v=' + version;
        sharedWorker ??= new PDFWorker();
        const task = getDocument({
          ...input,
          worker: sharedWorker,
          cMapUrl: '/pdfjs/cmaps/',
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
          iccUrl: '/pdfjs/iccs/',
        });
        destroy = () => (task.destroyed ? Promise.resolve() : task.destroy());
        const document = await task.promise;

        if (!cancelled) {
          setLoaded({ source, document });
        }
      } catch {
        if (!cancelled) {
          setFailed(source);
        }
      }
    }

    let observer: IntersectionObserver | undefined;

    if (expanded || !('IntersectionObserver' in window)) {
      void load();
    } else if (canvas.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            observer?.disconnect();
            void load();
          }
        },
        { rootMargin: '100px' }
      );
      observer.observe(canvas.current);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      void destroy?.();
    };
  }, [source, expanded]);

  useEffect(() => {
    if (!pdf) {
      return;
    }

    let cancelled = false;
    let render: RenderTask | undefined;

    async function paint(doc: PDFDocumentProxy) {
      try {
        const sheet = await doc.getPage(page);
        const target = canvas.current;

        if (cancelled || !target) {
          return;
        }

        const { width, height } = sheet.getViewport({ scale: 1 });
        const maxSide = expanded ? 1800 : 144;
        const viewport = sheet.getViewport({
          scale: maxSide / Math.max(width, height),
        });
        target.width = Math.max(1, Math.ceil(viewport.width));
        target.height = Math.max(1, Math.ceil(viewport.height));
        render = sheet.render({ canvas: target, viewport });
        await render.promise;

        if (!expanded && !cancelled) {
          setLoaded(null);
          await doc.loadingTask.destroy();
        }
      } catch {
        if (!cancelled) {
          setFailed(source);
        }
      }
    }

    void paint(pdf);

    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, page, expanded, source]);

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        hidden={failed}
        className={
          expanded
            ? 'mx-auto max-h-[70dvh] max-w-full object-contain'
            : 'h-full w-full object-contain'
        }
      />
      {failed && expanded && <p role="status">{t('previewUnavailable')}</p>}
      {expanded && !failed && pdf && pdf.numPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Button
            type="button"
            outline
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {t('previousPage')}
          </Button>
          <span aria-live="polite">
            {t('previewPage', { page, count: pdf.numPages })}
          </span>
          <Button
            type="button"
            outline
            disabled={page === pdf.numPages}
            onClick={() => setPage(page + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      )}
    </>
  );
}
