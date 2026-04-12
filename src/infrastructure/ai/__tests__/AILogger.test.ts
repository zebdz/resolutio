import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { AILogger } from '../AILogger';

describe('AILogger', () => {
  const testLogsDir = path.join(process.cwd(), 'logs-test-ai-' + Date.now());
  let logger: AILogger;

  beforeEach(() => {
    logger = new AILogger(testLogsDir);
  });

  afterEach(async () => {
    await fs.rm(testLogsDir, { recursive: true, force: true });
  });

  it('creates logs directory on first write', async () => {
    await logger.logSuccess({
      pollId: 'poll-1',
      userId: 'user-1',
      model: 'google',
      inputTokens: 500,
      outputTokens: 200,
      annotationCount: 2,
      overallRisk: 'medium',
      message: 'Analysis complete',
    });

    const exists = await fs
      .access(testLogsDir)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('writes success entry as JSON line with level "info"', async () => {
    await logger.logSuccess({
      pollId: 'poll-1',
      userId: 'user-1',
      model: 'google',
      inputTokens: 500,
      outputTokens: 200,
      annotationCount: 2,
      overallRisk: 'medium',
      message: 'Analysis complete',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'ai.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    expect(entry.level).toBe('info');
    expect(entry.pollId).toBe('poll-1');
    expect(entry.model).toBe('google');
    expect(entry.inputTokens).toBe(500);
    expect(entry.outputTokens).toBe(200);
    expect(entry.annotationCount).toBe(2);
    expect(entry.overallRisk).toBe('medium');
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestamp_msk).toBeDefined();
  });

  it('writes error entry as JSON line with level "error"', async () => {
    await logger.logError({
      pollId: 'poll-1',
      userId: 'user-1',
      model: 'deepseek',
      error: 'Quota exceeded',
      stack: 'Error: Quota exceeded\n    at ...',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'ai.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    expect(entry.level).toBe('error');
    expect(entry.pollId).toBe('poll-1');
    expect(entry.model).toBe('deepseek');
    expect(entry.error).toBe('Quota exceeded');
    expect(entry.stack).toContain('Quota exceeded');
  });

  it('includes timestamp_msk in Moscow timezone format', async () => {
    await logger.logSuccess({
      pollId: 'poll-1',
      userId: 'user-1',
      model: 'google',
      inputTokens: 100,
      outputTokens: 50,
      annotationCount: 0,
      overallRisk: 'low',
      message: 'Analysis complete',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'ai.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    expect(entry.timestamp_msk).toMatch(
      /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}$/
    );
  });

  it('appends multiple entries', async () => {
    await logger.logSuccess({
      pollId: 'poll-1',
      userId: 'user-1',
      model: 'google',
      inputTokens: 100,
      outputTokens: 50,
      annotationCount: 0,
      overallRisk: 'low',
      message: 'Analysis complete',
    });
    await logger.logError({
      pollId: 'poll-2',
      userId: 'user-1',
      model: 'deepseek',
      error: 'Provider timeout',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'ai.log'),
      'utf-8'
    );
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).level).toBe('info');
    expect(JSON.parse(lines[1]).level).toBe('error');
  });
});
