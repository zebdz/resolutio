import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { SmsRuLogger } from '../SmsRuLogger';

describe('SmsRuLogger', () => {
  const testLogsDir = path.join(process.cwd(), 'logs-test-' + Date.now());
  let logger: SmsRuLogger;

  beforeEach(() => {
    logger = new SmsRuLogger(testLogsDir);
  });

  afterEach(async () => {
    await fs.rm(testLogsDir, { recursive: true, force: true });
  });

  it('should create logs directory on first write', async () => {
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'ru',
      statusCode: 100,
      smsId: '000-100',
      balance: 4122.56,
      cost: 1.77,
      testMode: false,
      clientIp: '10.0.0.1',
    });

    const exists = await fs
      .access(testLogsDir)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('should write success entry to sms-ru.log as JSON line', async () => {
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'ru',
      statusCode: 100,
      smsId: '000-100',
      balance: 4122.56,
      cost: 1.77,
      testMode: false,
      clientIp: '10.0.0.1',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    expect(entry.phone).toBe('79255070602');
    expect(entry.statusCode).toBe(100);
    expect(entry.smsId).toBe('000-100');
    expect(entry.balance).toBe(4122.56);
    expect(entry.testMode).toBe(false);
    expect(entry.clientIp).toBe('10.0.0.1');
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestamp_msk).toBeDefined();
  });

  it('should write error entry to both sms-ru.log and sms-ru.error.log', async () => {
    await logger.logError({
      phone: '79255070602',
      locale: 'ru',
      statusCode: 201,
      error: 'Insufficient balance',
      retryAttempt: 0,
      testMode: false,
      clientIp: '10.0.0.1',
    });

    const mainLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const errorLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.error.log'),
      'utf-8'
    );

    const mainEntry = JSON.parse(mainLog.trim());
    const errorEntry = JSON.parse(errorLog.trim());

    expect(mainEntry.statusCode).toBe(201);
    expect(mainEntry.error).toBe('Insufficient balance');
    expect(errorEntry.statusCode).toBe(201);
    expect(errorEntry.retryAttempt).toBe(0);
  });

  it('should include timestamp_msk in Moscow timezone (UTC+3)', async () => {
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'en',
      statusCode: 100,
      smsId: '000-200',
      balance: 100,
      cost: 1.77,
      testMode: true,
      clientIp: '10.0.0.1',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    // Human-readable Moscow time, e.g. "20.03.2026, 15:34:56"
    expect(entry.timestamp_msk).toMatch(
      /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}$/
    );
  });

  it('should append multiple entries', async () => {
    await logger.logSuccess({
      phone: '79255070601',
      locale: 'ru',
      statusCode: 100,
      smsId: '000-1',
      balance: 100,
      cost: 1.77,
      testMode: false,
      clientIp: '10.0.0.1',
    });
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'en',
      statusCode: 100,
      smsId: '000-2',
      balance: 99,
      cost: 1.5,
      testMode: false,
      clientIp: '10.0.0.1',
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).phone).toBe('79255070601');
    expect(JSON.parse(lines[1]).phone).toBe('79255070602');
  });

  it('should write cost exceeded entry to both log files', async () => {
    await logger.logCostExceeded({
      phone: '44712345678',
      locale: 'en',
      cost: 8.5,
      maxCost: 2.5,
      testMode: false,
      clientIp: '10.0.0.1',
    });

    const mainLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const errorLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.error.log'),
      'utf-8'
    );

    const mainEntry = JSON.parse(mainLog.trim());
    const errorEntry = JSON.parse(errorLog.trim());

    expect(mainEntry.phone).toBe('44712345678');
    expect(mainEntry.cost).toBe(8.5);
    expect(mainEntry.maxCost).toBe(2.5);
    expect(errorEntry.cost).toBe(8.5);
    expect(errorEntry.maxCost).toBe(2.5);
  });

  it('should write undeliverable entry to both log files', async () => {
    await logger.logUndeliverable({
      phone: '44712345678',
      locale: 'en',
      statusCode: 207,
      statusText: 'No delivery route for this number',
      testMode: false,
      clientIp: '10.0.0.1',
    });

    const mainLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const errorLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.error.log'),
      'utf-8'
    );

    const mainEntry = JSON.parse(mainLog.trim());
    const errorEntry = JSON.parse(errorLog.trim());

    expect(mainEntry.phone).toBe('44712345678');
    expect(mainEntry.statusCode).toBe(207);
    expect(mainEntry.statusText).toBe('No delivery route for this number');
    expect(errorEntry.statusCode).toBe(207);
  });
});
