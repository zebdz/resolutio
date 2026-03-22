// src/app/[locale]/superadmin/logs/LogViewerPanel.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/app/components/catalyst/dialog';

interface LogFile {
  id: string;
  label: string;
  exists: boolean;
  sizeBytes: number;
  totalLines: number;
  json: boolean;
  archived: boolean;
}

interface ChunkResult {
  lines: string[];
  startLine: number;
  endLine: number;
  totalLines: number;
  hasMore: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function LogViewerPanel() {
  const t = useTranslations('superadmin.logs');

  // State
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [mode, setMode] = useState<'head' | 'tail'>('tail');
  const [lines, setLines] = useState<string[]>([]);
  const [startLine, setStartLine] = useState(0);
  const [endLine, setEndLine] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prettify, setPrettify] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followPaused, setFollowPaused] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [scrollTo, setScrollTo] = useState<'top' | 'bottom' | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const followLinesRef = useRef<string[]>([]);

  const selectedFile = files.find((f) => f.id === selectedFileId);

  // Fetch file list
  useEffect(() => {
    fetch('/api/superadmin/logs')
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files);

        if (data.files.length > 0 && !selectedFileId) {
          setSelectedFileId(data.files[0].id);
        }
      })
      .catch(() => setError(t('connectionError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch chunk
  const fetchChunk = useCallback(
    async (
      fileId: string,
      chunkMode: 'head' | 'tail',
      offset: number,
      append: boolean
    ) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/superadmin/logs/${fileId}/read?mode=${chunkMode}&offset=${offset}`
        );

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || t('readFailed'));

          return;
        }

        const data: ChunkResult = await res.json();

        if (append) {
          if (chunkMode === 'head') {
            // Load more below (head mode)
            setLines((prev) => [...prev, ...data.lines]);
            setEndLine(data.endLine);
          } else {
            // Load more above (tail mode)
            setLines((prev) => [...data.lines, ...prev]);
            setStartLine(data.startLine);
          }
        } else {
          setLines(data.lines);
          setStartLine(data.startLine);
          setEndLine(data.endLine);
        }

        setTotalLines(data.totalLines);
        setHasMore(data.hasMore);
      } catch {
        setError(t('readFailed'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  // Load initial chunk when file changes
  useEffect(() => {
    if (selectedFileId) {
      stopFollowing();
      fetchChunk(selectedFileId, mode, 0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

  const stopFollowing = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setFollowing(false);
    setFollowPaused(false);
  }, []);

  // Follow mode
  const startFollowing = useCallback(() => {
    if (!selectedFileId) {
      return;
    }

    stopFollowing();
    setFollowing(true);
    setFollowPaused(false);
    followLinesRef.current = [];

    const es = new EventSource(`/api/superadmin/logs/${selectedFileId}/follow`);

    es.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.type === 'truncated') {
          setLines([]);
          setStartLine(0);
          setEndLine(0);
          setTotalLines(0);
          followLinesRef.current = [];

          return;
        }

        if (parsed.type === 'line') {
          followLinesRef.current.push(parsed.data);

          // Cap at 500 lines
          if (followLinesRef.current.length > 500) {
            followLinesRef.current = followLinesRef.current.slice(-500);
          }

          setLines([...followLinesRef.current]);
          setTotalLines((prev) => prev + 1);
          setEndLine((prev) => prev + 1);
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      setError(t('connectionError'));
      setFollowing(false);
      es.close();
    };

    eventSourceRef.current = es;
  }, [selectedFileId, t, stopFollowing]);

  // Auto-scroll when following and not paused
  useEffect(() => {
    if (following && !followPaused && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines, following, followPaused]);

  // Scroll after top/bottom navigation
  useEffect(() => {
    if (scrollTo && contentRef.current && lines.length > 0) {
      if (scrollTo === 'top') {
        contentRef.current.scrollTop = 0;
      } else {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }

      setScrollTo(null);
    }
  }, [lines, scrollTo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handlers
  const handleModeChange = (newMode: 'head' | 'tail') => {
    stopFollowing();
    setMode(newMode);
    setLines([]);
    fetchChunk(selectedFileId, newMode, 0, false);
  };

  const handleGoTop = () => {
    stopFollowing();
    setMode('head');
    setLines([]);
    setScrollTo('top');
    fetchChunk(selectedFileId, 'head', 0, false);
  };

  const handleGoBottom = () => {
    stopFollowing();
    setMode('tail');
    setLines([]);
    setScrollTo('bottom');
    fetchChunk(selectedFileId, 'tail', 0, false);
  };

  const handleLoadMore = () => {
    if (mode === 'head') {
      fetchChunk(selectedFileId, 'head', endLine, true);
    } else {
      const offset = totalLines - startLine + 1;
      fetchChunk(selectedFileId, 'tail', offset, true);
    }
  };

  const handleFileChange = (fileId: string) => {
    stopFollowing();
    setSelectedFileId(fileId);
    setMode('tail');
    setLines([]);
    setPrettify(false);
  };

  const handleDownload = () => {
    window.open(`/api/superadmin/logs/${selectedFileId}/download`, '_blank');
  };

  const handleArchive = async () => {
    setArchiving(true);

    try {
      const res = await fetch(
        `/api/superadmin/logs/${selectedFileId}/archive`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('archiveFailed'));

        return;
      }

      setArchiveDialogOpen(false);
      setLines([]);
      setStartLine(0);
      setEndLine(0);
      setTotalLines(0);
      setError(null);

      // Refresh file list
      const listRes = await fetch('/api/superadmin/logs');
      const listData = await listRes.json();
      setFiles(listData.files);

      // Show success briefly
      setArchiveSuccess(true);
      setTimeout(() => setArchiveSuccess(false), 3000);
    } catch {
      setError(t('archiveFailed'));
    } finally {
      setArchiving(false);
    }
  };

  // Format line for display
  const formatLine = (line: string): string => {
    if (!prettify) {
      return line;
    }

    try {
      return JSON.stringify(JSON.parse(line), null, 2);
    } catch {
      return line;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* File selector */}
        <select
          value={selectedFileId}
          onChange={(e) => handleFileChange(e.target.value)}
          className="max-w-full min-w-0 cursor-pointer truncate rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {files
            .filter((f) => !f.archived)
            .map((f) => (
              <option key={f.id} value={f.id} disabled={!f.exists}>
                {f.label}
                {f.exists
                  ? ` (${formatBytes(f.sizeBytes)})`
                  : ` (${t('noFile')})`}
              </option>
            ))}
          {showArchived && <option disabled>{t('archivedSeparator')}</option>}
          {showArchived &&
            files
              .filter((f) => f.archived)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} ({formatBytes(f.sizeBytes)})
                </option>
              ))}
        </select>

        {files.some((f) => f.archived) && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {showArchived ? t('hideArchived') : t('showArchived')}
          </button>
        )}

        {/* Mode toggle */}
        <div className="flex rounded-md border border-zinc-300 dark:border-zinc-600">
          <button
            onClick={() => handleModeChange('head')}
            className={`cursor-pointer px-3 py-1.5 text-sm ${
              mode === 'head' && !following
                ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
            } rounded-l-md`}
          >
            {t('head')}
          </button>
          <button
            onClick={() => handleModeChange('tail')}
            className={`cursor-pointer px-3 py-1.5 text-sm ${
              mode === 'tail' && !following
                ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
            } rounded-r-md`}
          >
            {t('tail')}
          </button>
        </div>

        {/* Follow button — disabled for archived files */}
        {!following ? (
          <Button
            onClick={startFollowing}
            disabled={!selectedFile?.exists || selectedFile?.archived}
            outline
          >
            &#9654; {t('follow')}
          </Button>
        ) : (
          <Button
            onClick={() => setFollowPaused(!followPaused)}
            color={followPaused ? 'green' : 'amber'}
          >
            {followPaused ? t('resume') : t('pause')}
          </Button>
        )}

        {/* Prettify toggle */}
        {selectedFile?.json &&
          (prettify ? (
            <Button onClick={() => setPrettify(false)} color="blue">
              {t('prettify')}
            </Button>
          ) : (
            <Button onClick={() => setPrettify(true)} outline>
              {t('prettify')}
            </Button>
          ))}

        <div className="flex-1" />

        {/* Download */}
        <Button
          onClick={handleDownload}
          disabled={!selectedFile?.exists}
          outline
        >
          &#8595; {t('download')}
        </Button>

        {/* Archive — disabled for archived files */}
        <Button
          onClick={() => setArchiveDialogOpen(true)}
          disabled={!selectedFile?.exists || selectedFile?.archived}
          color="red"
        >
          {t('archive')}
        </Button>
      </div>

      {/* Following indicator */}
      {following && (
        <div
          className={`rounded-md px-3 py-1.5 text-sm ${
            followPaused
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          }`}
        >
          {followPaused ? t('paused') : t('following')}
        </div>
      )}

      {/* Success */}
      {archiveSuccess && (
        <div className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {t('archiveSuccess')}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Log content */}
      <div
        ref={contentRef}
        className="max-h-[70vh] min-h-[400px] overflow-auto rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-300"
      >
        {lines.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            {selectedFile?.exists ? t('emptyFile') : t('noFile')}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words">
            {lines.map((line, i) => (
              <div key={`${startLine + i}-${i}`} className="hover:bg-zinc-800">
                {formatLine(line)}
              </div>
            ))}
          </pre>
        )}
      </div>

      {/* Status bar */}
      {!following && lines.length > 0 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <button
            onClick={handleGoTop}
            className="cursor-pointer hover:text-zinc-300"
            disabled={loading}
          >
            &#11014; {t('top')}
          </button>

          <span>
            {t('lineInfo', {
              start: startLine,
              end: endLine,
              total: totalLines,
            })}
          </span>

          <button
            onClick={handleGoBottom}
            className="cursor-pointer hover:text-zinc-300"
            disabled={loading}
          >
            &#11015; {t('bottom')}
          </button>
        </div>
      )}

      {/* Load more */}
      {!following && hasMore && (
        <div className="flex justify-center">
          <Button onClick={handleLoadMore} disabled={loading} outline>
            {loading ? '...' : t('loadMore')}
          </Button>
        </div>
      )}

      {/* Archive dialog */}
      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
      >
        <DialogTitle>{t('archiveConfirmTitle')}</DialogTitle>
        <DialogBody>
          <p>
            {t('archiveConfirmMessage', {
              filename: selectedFile?.label ?? '',
              size: formatBytes(selectedFile?.sizeBytes ?? 0),
            })}
          </p>
        </DialogBody>
        <DialogActions>
          <Button
            outline
            onClick={() => setArchiveDialogOpen(false)}
            disabled={archiving}
          >
            {t('cancel')}
          </Button>
          <Button color="red" onClick={handleArchive} disabled={archiving}>
            {archiving ? '...' : t('archiveConfirmButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
