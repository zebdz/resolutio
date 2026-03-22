import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadminApi } from '@/web/lib/superadminApiAuth';
import {
  getLogSource,
  resolveLogPath,
  resolveArchivePath,
} from '@/infrastructure/logs/logSources';
import { readChunk } from '@/infrastructure/logs/logFileReader';
import { readArchivedChunk } from '@/infrastructure/logs/logArchiveReader';
import fs from 'fs';

const CHUNK_SIZE = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadminApi();

  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;

  const mode =
    request.nextUrl.searchParams.get('mode') === 'head' ? 'head' : 'tail';
  const offset = Math.max(
    0,
    parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10) || 0
  );

  // Archived file
  if (id.startsWith('archive:')) {
    const archiveFilename = id.replace('archive:', '') + '.zip';
    const archivePath = resolveArchivePath(archiveFilename);

    if (!archivePath) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = readArchivedChunk(archivePath, mode, offset, CHUNK_SIZE);

    return NextResponse.json(result);
  }

  // Live file
  const source = getLogSource(id);

  if (!source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = resolveLogPath(source);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const result = await readChunk(filePath, mode, offset, CHUNK_SIZE);

  return NextResponse.json(result);
}
