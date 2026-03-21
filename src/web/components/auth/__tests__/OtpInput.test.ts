import { describe, it, expect } from 'vitest';

import { processOtpInput } from '../OtpInput';

describe('processOtpInput', () => {
  const emptyDigits = ['', '', '', '', '', ''];

  describe('SMS autofill (multi-digit input)', () => {
    it('accepts full 6-digit code pasted/autofilled into a single input', () => {
      const result = processOtpInput('123456', 0, emptyDigits, 6);

      expect(result).toEqual({
        type: 'multi',
        value: '123456',
        focusIndex: 5,
      });
    });

    it('truncates autofilled code longer than max length', () => {
      const result = processOtpInput('12345678', 0, emptyDigits, 6);

      expect(result).toEqual({
        type: 'multi',
        value: '123456',
        focusIndex: 5,
      });
    });

    it('handles autofill with non-digit characters mixed in', () => {
      const result = processOtpInput('1-2-3-4-5-6', 0, emptyDigits, 6);

      expect(result).toEqual({
        type: 'multi',
        value: '123456',
        focusIndex: 5,
      });
    });
  });

  describe('single digit input', () => {
    it('sets digit at correct index', () => {
      const result = processOtpInput('5', 2, emptyDigits, 6);

      expect(result).toEqual({
        type: 'single',
        value: '5',
        focusIndex: 3,
      });
    });

    it('focuses next input after entering a digit', () => {
      const result = processOtpInput('3', 0, emptyDigits, 6);

      expect(result).toEqual({
        type: 'single',
        value: '3',
        focusIndex: 1,
      });
    });

    it('does not advance focus on last digit', () => {
      const result = processOtpInput('9', 5, emptyDigits, 6);

      expect(result).toEqual({
        type: 'single',
        value: '9',
        focusIndex: null,
      });
    });

    it('clears a digit (empty input)', () => {
      const digits = ['1', '2', '3', '', '', ''];
      const result = processOtpInput('', 1, digits, 6);

      expect(result).toEqual({
        type: 'single',
        value: '13',
        focusIndex: null,
      });
    });
  });

  describe('rejection', () => {
    it('ignores non-digit input', () => {
      const result = processOtpInput('abc', 0, emptyDigits, 6);

      expect(result).toEqual({ type: 'ignore' });
    });
  });
});
