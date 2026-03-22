import fs from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadminApi } from '@/web/lib/superadminApiAuth';
import {
  getLogSource,
  resolveLogPath,
  resolveArchivePath,
} from '@/infrastructure/logs/logSources';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadminApi();

  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;

  let filePath: string;
  let filename: string;
  let contentType = 'application/octet-stream';

  // Archived file — download the zip itself
  if (id.startsWith('archive:')) {
    const archiveFilename = id.replace('archive:', '') + '.zip';
    const archivePath = resolveArchivePath(archiveFilename);

    if (!archivePath) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    filePath = archivePath;
    filename = archiveFilename;
    contentType = 'application/zip';
  } else {
    const source = getLogSource(id);

    if (!source) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    filePath = resolveLogPath(source);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    filename = path.basename(source.path);
  }

  const stat = fs.statSync(filePath);
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stat.size.toString(),
    },
  });
}
