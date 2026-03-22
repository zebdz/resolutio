import fs from 'fs';
import path from 'path';

export interface LogSource {
  id: string;
  path: string;
  label: string;
  json: boolean;
}

export const LOG_SOURCES: LogSource[] = [
  { id: 'deploy', path: 'deploy.log', label: 'Deploy Log', json: false },
  { id: 'sms', path: 'logs/sms-ru.log', label: 'SMS Log', json: true },
  {
    id: 'sms-error',
    path: 'logs/sms-ru.error.log',
    label: 'SMS Errors',
    json: true,
  },
];

export const ARCHIVE_DIR = path.join(process.cwd(), 'logs', 'archive');

export function getLogSource(id: string): LogSource | undefined {
  return LOG_SOURCES.find((s) => s.id === id);
}

export function resolveLogPath(source: LogSource): string {
  return path.join(process.cwd(), source.path);
}

/**
 * Infer whether an archived file contains JSON based on the source ID prefix.
 */
export function isArchivedFileJson(archiveFilename: string): boolean {
  return LOG_SOURCES.some(
    (s) => s.json && archiveFilename.startsWith(s.path.split('/').pop()!)
  );
}

/**
 * Scan logs/archive/ for zip files, return sorted descending by filename.
 */
export function listArchiveFiles(): string[] {
  try {
    const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith('.zip'));

    return files.sort().reverse();
  } catch {
    return [];
  }
}

/**
 * Resolve full path to an archive file. Returns null if file doesn't exist
 * or if the filename tries to escape the archive directory.
 */
export function resolveArchivePath(filename: string): string | null {
  const resolved = path.join(ARCHIVE_DIR, filename);

  if (!resolved.startsWith(ARCHIVE_DIR)) {
    return null;
  }

  try {
    fs.accessSync(resolved);

    return resolved;
  } catch {
    return null;
  }
}
