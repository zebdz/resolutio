import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { countLines, readChunk } from '../logFileReader';

const TEST_DIR = path.join(process.cwd(), 'tmp-test-logs');
const TEST_FILE = path.join(TEST_DIR, 'test.log');

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
  fs.writeFileSync(TEST_FILE, lines.join('\n') + '\n');
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('countLines', () => {
  it('counts lines in a file via streaming', async () => {
    const count = await countLines(TEST_FILE);
    expect(count).toBe(10);
  });

  it('returns 0 for empty file', async () => {
    const emptyFile = path.join(TEST_DIR, 'empty.log');
    fs.writeFileSync(emptyFile, '');
    const count = await countLines(emptyFile);
    expect(count).toBe(0);
  });
});

describe('readChunk', () => {
  it('reads head with offset=0', async () => {
    const result = await readChunk(TEST_FILE, 'head', 0, 3);
    expect(result.lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(3);
    expect(result.totalLines).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('reads head with offset=5', async () => {
    const result = await readChunk(TEST_FILE, 'head', 5, 3);
    expect(result.lines).toEqual(['Line 6', 'Line 7', 'Line 8']);
    expect(result.startLine).toBe(6);
    expect(result.endLine).toBe(8);
    expect(result.hasMore).toBe(true);
  });

  it('reads tail with offset=0', async () => {
    const result = await readChunk(TEST_FILE, 'tail', 0, 3);
    expect(result.lines).toEqual(['Line 8', 'Line 9', 'Line 10']);
    expect(result.startLine).toBe(8);
    expect(result.endLine).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('reads tail with offset=5', async () => {
    const result = await readChunk(TEST_FILE, 'tail', 5, 3);
    expect(result.lines).toEqual(['Line 3', 'Line 4', 'Line 5']);
    expect(result.startLine).toBe(3);
    expect(result.endLine).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore=false when no more lines', async () => {
    const result = await readChunk(TEST_FILE, 'head', 8, 3);
    expect(result.lines).toEqual(['Line 9', 'Line 10']);
    expect(result.hasMore).toBe(false);
  });
});
