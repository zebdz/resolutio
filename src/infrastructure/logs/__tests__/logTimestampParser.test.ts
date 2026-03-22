import { describe, it, expect } from 'vitest';
import {
  extractTimestampFromBracketFormat,
  extractTimestampFromJson,
  formatTimestampForArchive,
} from '../logTimestampParser';

describe('extractTimestampFromBracketFormat', () => {
  it('parses [YYYY-MM-DD HH:MM:SS] format', () => {
    const line = '[2025-03-21 11:59:30] Starting deployment...';
    const result = extractTimestampFromBracketFormat(line);
    expect(result).toEqual(new Date('2025-03-21T11:59:30'));
  });

  it('parses ISO timestamp after a label bracket (app console.log format)', () => {
    const line =
      '[UserBlock] 2026-03-22T11:58:24.220Z blocked userId=cmn0s reason="123"';
    const result = extractTimestampFromBracketFormat(line);
    expect(result).toEqual(new Date('2026-03-22T11:58:24.220Z'));
  });

  it('parses ISO timestamp from RateLimitAdmin log', () => {
    const line =
      '[RateLimitAdmin] 2026-03-22T11:56:37.302Z resetKeys label=serverActionSession';
    const result = extractTimestampFromBracketFormat(line);
    expect(result).toEqual(new Date('2026-03-22T11:56:37.302Z'));
  });

  it('returns null for unparseable lines', () => {
    expect(extractTimestampFromBracketFormat('no timestamp here')).toBeNull();
    expect(extractTimestampFromBracketFormat(' ✓ Starting...')).toBeNull();
  });
});

describe('extractTimestampFromJson', () => {
  it('parses timestamp_msk in DD.MM.YYYY, HH:MM:SS format (actual SmsRuLogger format)', () => {
    const line = JSON.stringify({
      timestamp: '2026-03-20T11:15:14.310Z',
      timestamp_msk: '20.03.2026, 11:15:14',
      phone: '+79161000099',
    });
    const result = extractTimestampFromJson(line);
    expect(result).toEqual(new Date(2026, 2, 20, 11, 15, 14));
  });

  it('falls back to timestamp field', () => {
    const line = JSON.stringify({ timestamp: '2025-03-21T08:59:30.000Z' });
    const result = extractTimestampFromJson(line);
    expect(result).toEqual(new Date('2025-03-21T08:59:30.000Z'));
  });

  it('returns null for invalid JSON', () => {
    expect(extractTimestampFromJson('not json')).toBeNull();
  });
});

describe('formatTimestampForArchive', () => {
  it('converts UTC to MSK (UTC+3)', () => {
    // 11:59 UTC = 14:59 MSK
    const date = new Date('2025-03-21T11:59:00.000Z');
    const result = formatTimestampForArchive(date);
    expect(result).toBe('2025-03-21_14:59_MSK');
  });

  it('handles day rollover from UTC to MSK', () => {
    // 22:30 UTC = 01:30 MSK next day
    const date = new Date('2025-03-21T22:30:00.000Z');
    const result = formatTimestampForArchive(date);
    expect(result).toBe('2025-03-22_01:30_MSK');
  });
});
