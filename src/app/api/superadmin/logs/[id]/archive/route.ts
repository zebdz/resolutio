import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadminApi } from '@/web/lib/superadminApiAuth';
import {
  getLogSource,
  resolveLogPath,
  ARCHIVE_DIR,
} from '@/infrastructure/logs/logSources';
import { buildArchiveFilename } from '@/infrastructure/logs/logTimestampParser';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadminApi();

  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;
  const source = getLogSource(id);

  if (!source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = resolveLogPath(source);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    // 1. Create archive directory
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

    // 2. Build filename with first/last timestamps
    const originalFilename = path.basename(source.path);
    const zipFileName = await buildArchiveFilename(
      filePath,
      originalFilename,
      source.json
    );
    const zipPath = path.join(ARCHIVE_DIR, zipFileName);

    // 3. Zip the file
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(filePath, { name: originalFilename });
      archive.finalize();
    });

    // 4. Verify zip
    const zipStat = fs.statSync(zipPath);

    if (zipStat.size === 0) {
      fs.unlinkSync(zipPath);

      return NextResponse.json(
        { error: 'Archive verification failed' },
        { status: 500 }
      );
    }

    // 5. Truncate original
    fs.truncateSync(filePath, 0);

    return NextResponse.json({
      success: true,
      archivePath: `logs/archive/${zipFileName}`,
    });
  } catch (error) {
    console.error('Archive error:', error);

    return NextResponse.json({ error: 'Archive failed' }, { status: 500 });
  }
}
