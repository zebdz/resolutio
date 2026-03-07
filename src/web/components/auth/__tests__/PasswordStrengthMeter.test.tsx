import { describe, it, expect } from 'vitest';
import { getStrengthConfig, STRENGTH_LEVELS } from '../passwordStrengthConfig';

describe('PasswordStrengthMeter', () => {
  describe('STRENGTH_LEVELS', () => {
    it('should have 5 levels (scores 0-4)', () => {
      expect(STRENGTH_LEVELS).toHaveLength(5);
    });

    it('should map each zxcvbn score to a color and label key', () => {
      expect(STRENGTH_LEVELS[0]).toEqual({
        color: 'bg-red-500',
        labelKey: 'veryWeak',
      });
      expect(STRENGTH_LEVELS[1]).toEqual({
        color: 'bg-orange-500',
        labelKey: 'weak',
      });
      expect(STRENGTH_LEVELS[2]).toEqual({
        color: 'bg-yellow-500',
        labelKey: 'fair',
      });
      expect(STRENGTH_LEVELS[3]).toEqual({
        color: 'bg-lime-500',
        labelKey: 'strong',
      });
      expect(STRENGTH_LEVELS[4]).toEqual({
        color: 'bg-green-500',
        labelKey: 'veryStrong',
      });
    });
  });

  describe('getStrengthConfig', () => {
    it('should return null for empty password', () => {
      expect(getStrengthConfig('')).toBeNull();
    });

    it('should return null for null score', () => {
      expect(getStrengthConfig('test', null)).toBeNull();
    });

    it('should return correct config for each score', () => {
      for (let score = 0; score <= 4; score++) {
        const config = getStrengthConfig('password', score);
        expect(config).not.toBeNull();
        expect(config!.color).toBe(STRENGTH_LEVELS[score].color);
        expect(config!.labelKey).toBe(STRENGTH_LEVELS[score].labelKey);
        expect(config!.percentage).toBe(((score + 1) / 5) * 100);
      }
    });

    it('should calculate correct percentages', () => {
      expect(getStrengthConfig('p', 0)!.percentage).toBe(20);
      expect(getStrengthConfig('p', 1)!.percentage).toBe(40);
      expect(getStrengthConfig('p', 2)!.percentage).toBe(60);
      expect(getStrengthConfig('p', 3)!.percentage).toBe(80);
      expect(getStrengthConfig('p', 4)!.percentage).toBe(100);
    });
  });

  describe('language-common exports', () => {
    it('should export dictionary and adjacencyGraphs as named exports', async () => {
      const common = await import('@zxcvbn-ts/language-common');
      expect(common.dictionary).toBeDefined();
      expect(common.adjacencyGraphs).toBeDefined();
    });
  });
});
