import { describe, it, expect } from 'vitest';
import { formatCountdown } from '../formatCountdown';

describe('formatCountdown', () => {
  it('renders minutes and zero-padded seconds', () => {
    expect(formatCountdown(299)).toBe('4:59');
  });

  it('adds an hours field once the wait reaches an hour', () => {
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(86399)).toBe('23:59:59');
  });

  it('never goes below zero', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
