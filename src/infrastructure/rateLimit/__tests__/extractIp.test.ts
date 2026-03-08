import { describe, it, expect } from 'vitest';

import { extractIpFromRequest } from '../extractIp';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/', { headers });
}

describe('extractIpFromRequest', () => {
  it('extracts first IP from multi-IP x-forwarded-for', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178',
    });

    expect(extractIpFromRequest(req)).toBe('203.0.113.50');
  });

  it('extracts single IP from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });

    expect(extractIpFromRequest(req)).toBe('203.0.113.50');
  });

  it('falls back to x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '10.0.0.1' });

    expect(extractIpFromRequest(req)).toBe('10.0.0.1');
  });

  it('falls back to 127.0.0.1 when no headers', () => {
    const req = makeRequest();

    expect(extractIpFromRequest(req)).toBe('127.0.0.1');
  });

  it('trims whitespace', () => {
    const req = makeRequest({
      'x-forwarded-for': '  203.0.113.50  , 10.0.0.1',
    });

    expect(extractIpFromRequest(req)).toBe('203.0.113.50');
  });

  it('normalizes IPv6 loopback ::1 to 127.0.0.1', () => {
    const req = makeRequest({ 'x-forwarded-for': '::1' });

    expect(extractIpFromRequest(req)).toBe('127.0.0.1');
  });

  it('normalizes IPv4-mapped IPv6 loopback ::ffff:127.0.0.1 to 127.0.0.1', () => {
    const req = makeRequest({ 'x-forwarded-for': '::ffff:127.0.0.1' });

    expect(extractIpFromRequest(req)).toBe('127.0.0.1');
  });

  it('normalizes IPv6 loopback in x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '::1' });

    expect(extractIpFromRequest(req)).toBe('127.0.0.1');
  });
});
