import AdmZip from 'adm-zip';
import type { ChunkResult } from './logFileReader';

function readLinesFromZip(zipPath: string): string[] {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  if (entries.length === 0) {
    return [];
  }

  const content = entries[0].getData().toString('utf-8');

  return content.split('\n').filter((l) => l.length > 0);
}

export function countArchivedLines(zipPath: string): number {
  const lines = readLinesFromZip(zipPath);

  return lines.length;
}

export function readArchivedChunk(
  zipPath: string,
  mode: 'head' | 'tail',
  offset: number,
  chunkSize: number
): ChunkResult {
  const allLines = readLinesFromZip(zipPath);
  const totalLines = allLines.length;

  let start: number;
  let end: number;

  if (mode === 'head') {
    start = offset;
    end = Math.min(start + chunkSize, totalLines);
  } else {
    end = totalLines - offset;
    start = Math.max(end - chunkSize, 0);
  }

  if (start >= totalLines || end <= 0) {
    return { lines: [], startLine: 0, endLine: 0, totalLines, hasMore: false };
  }

  start = Math.max(start, 0);
  end = Math.min(end, totalLines);

  const lines = allLines.slice(start, end);
  const hasMore = mode === 'head' ? end < totalLines : start > 0;

  return {
    lines,
    startLine: start + 1,
    endLine: end,
    totalLines,
    hasMore,
  };
}
