import fs from 'fs';
import readline from 'readline';
import { createReadStream } from 'fs';

export function extractTimestampFromBracketFormat(line: string): Date | null {
  // Format 1: [2026-03-21 23:08:23] (deploy script log() function)
  const bracketMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);

  if (bracketMatch) {
    const date = new Date(bracketMatch[1].replace(' ', 'T'));

    return isNaN(date.getTime()) ? null : date;
  }

  // Format 2: [Label] 2026-03-22T11:58:24.220Z (app console.log)
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.]*Z?)/);

  if (isoMatch) {
    const date = new Date(isoMatch[1]);

    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function extractTimestampFromJson(line: string): Date | null {
  try {
    const parsed = JSON.parse(line);

    if (parsed.timestamp_msk) {
      // Format: "20.03.2026, 11:15:14" (DD.MM.YYYY, HH:MM:SS)
      const match = parsed.timestamp_msk.match(
        /(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/
      );

      if (match) {
        const [, dd, mm, yyyy, hh, min, ss] = match;
        const date = new Date(
          Number(yyyy),
          Number(mm) - 1,
          Number(dd),
          Number(hh),
          Number(min),
          Number(ss)
        );

        return isNaN(date.getTime()) ? null : date;
      }

      return null;
    }

    if (parsed.timestamp) {
      const date = new Date(parsed.timestamp);

      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  } catch {
    return null;
  }
}

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export function formatTimestampForArchive(date: Date): string {
  const msk = new Date(date.getTime() + MSK_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = msk.getUTCFullYear();
  const m = pad(msk.getUTCMonth() + 1);
  const d = pad(msk.getUTCDate());
  const h = pad(msk.getUTCHours());
  const min = pad(msk.getUTCMinutes());

  return `${y}-${m}-${d}_${h}:${min}_MSK`;
}

async function readFirstLine(filePath: string): Promise<string | null> {
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      rl.close();

      return line;
    }
  }

  return null;
}

async function readLastLine(filePath: string): Promise<string | null> {
  const stat = fs.statSync(filePath);

  if (stat.size === 0) {
    return null;
  }

  const bufSize = Math.min(4096, stat.size);
  const buffer = Buffer.alloc(bufSize);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, bufSize, stat.size - bufSize);
  fs.closeSync(fd);
  const lines = buffer
    .toString('utf-8')
    .split('\n')
    .filter((l) => l.trim());

  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export async function buildArchiveFilename(
  filePath: string,
  originalFilename: string,
  json: boolean
): Promise<string> {
  const extractFn = json
    ? extractTimestampFromJson
    : extractTimestampFromBracketFormat;
  const fallbackTimestamp = formatTimestampForArchive(new Date());
  const firstLine = await readFirstLine(filePath);
  const lastLine = await readLastLine(filePath);
  const firstTs = firstLine ? extractFn(firstLine) : null;
  const lastTs = lastLine ? extractFn(lastLine) : null;
  const firstFormatted = firstTs
    ? formatTimestampForArchive(firstTs)
    : fallbackTimestamp;
  const lastFormatted = lastTs
    ? formatTimestampForArchive(lastTs)
    : fallbackTimestamp;

  return `${originalFilename}.${firstFormatted}-${lastFormatted}.zip`;
}
