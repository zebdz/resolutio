import fs from 'fs';
import { createReadStream } from 'fs';
import readline from 'readline';

export interface ChunkResult {
  lines: string[];
  startLine: number;
  endLine: number;
  totalLines: number;
  hasMore: boolean;
}

export async function countLines(filePath: string): Promise<number> {
  const stat = fs.statSync(filePath);

  if (stat.size === 0) {
    return 0;
  }

  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    stream.on('data', (chunk) => {
      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');

      for (let i = 0; i < str.length; i++) {
        if (str[i] === '\n') {
          count++;
        }
      }
    });
    stream.on('end', () => resolve(count));
    stream.on('error', reject);
  });
}

async function readAllLines(filePath: string): Promise<string[]> {
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  const lines: string[] = [];

  for await (const line of rl) {
    lines.push(line);
  }

  return lines;
}

export async function readChunk(
  filePath: string,
  mode: 'head' | 'tail',
  offset: number,
  chunkSize: number
): Promise<ChunkResult> {
  const allLines = await readAllLines(filePath);
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
