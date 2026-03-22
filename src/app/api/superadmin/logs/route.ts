import fs from 'fs';
import { NextResponse } from 'next/server';
import { requireSuperadminApi } from '@/web/lib/superadminApiAuth';
import {
  LOG_SOURCES,
  resolveLogPath,
  listArchiveFiles,
  isArchivedFileJson,
  ARCHIVE_DIR,
} from '@/infrastructure/logs/logSources';
import { countLines } from '@/infrastructure/logs/logFileReader';
import { countArchivedLines } from '@/infrastructure/logs/logArchiveReader';
import path from 'path';

export async function GET() {
  const auth = await requireSuperadminApi();

  if (auth.error) {
    return auth.error;
  }

  // Live files
  const liveFiles = await Promise.all(
    LOG_SOURCES.map(async (source) => {
      const filePath = resolveLogPath(source);
      let exists = false;
      let sizeBytes = 0;
      let totalLines = 0;

      try {
        const stat = fs.statSync(filePath);
        exists = true;
        sizeBytes = stat.size;
        totalLines = await countLines(filePath);
      } catch {
        // file doesn't exist
      }

      return {
        id: source.id,
        label: source.label,
        exists,
        sizeBytes,
        totalLines,
        json: source.json,
        archived: false,
      };
    })
  );

  // Archived files (sorted descending by filename)
  const archiveFilenames = listArchiveFiles();
  const archivedFiles = await Promise.all(
    archiveFilenames.map(async (filename) => {
      const zipPath = path.join(ARCHIVE_DIR, filename);
      const stat = fs.statSync(zipPath);
      let totalLines = 0;

      try {
        totalLines = countArchivedLines(zipPath);
      } catch {
        // corrupt zip
      }

      return {
        id: `archive:${filename.replace('.zip', '')}`,
        label: filename,
        exists: true,
        sizeBytes: stat.size,
        totalLines,
        json: isArchivedFileJson(filename),
        archived: true,
      };
    })
  );

  return NextResponse.json({ files: [...liveFiles, ...archivedFiles] });
}
