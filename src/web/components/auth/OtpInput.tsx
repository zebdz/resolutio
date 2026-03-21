'use client';

import { useRef, useCallback } from 'react';
import clsx from 'clsx';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
};

export type OtpChangeResult =
  | { type: 'multi'; value: string; focusIndex: number }
  | { type: 'single'; value: string; focusIndex: number | null }
  | { type: 'ignore' };

export function processOtpInput(
  inputValue: string,
  index: number,
  currentDigits: string[],
  maxLength: number
): OtpChangeResult {
  const sanitized = inputValue.replace(/\D/g, '');

  if (!sanitized && inputValue !== '') {
    return { type: 'ignore' };
  }

  if (sanitized.length > 1) {
    const filled = sanitized.slice(0, maxLength);

    return {
      type: 'multi',
      value: filled,
      focusIndex: Math.min(filled.length, maxLength - 1),
    };
  }

  const newDigits = [...currentDigits];
  newDigits[index] = sanitized;
  const newValue = newDigits.join('').replace(/\s/g, '');

  return {
    type: 'single',
    value: newValue,
    focusIndex: sanitized && index < maxLength - 1 ? index + 1 : null,
  };
}

export function OtpInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
  length = 6,
}: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const focusInput = useCallback(
    (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus();
      }
    },
    [length]
  );

  const handleChange = useCallback(
    (index: number, inputValue: string) => {
      const result = processOtpInput(inputValue, index, digits, length);

      if (result.type === 'ignore') {
        return;
      }

      onChange(result.value);

      if (result.focusIndex !== null) {
        focusInput(result.focusIndex);
      }
    },
    [digits, onChange, length, focusInput]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          focusInput(index - 1);
          handleChange(index - 1, '');
        } else {
          handleChange(index, '');
        }

        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        focusInput(index - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        focusInput(index + 1);
        e.preventDefault();
      }
    },
    [digits, focusInput, handleChange, length]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData('text')
        .replace(/\D/g, '')
        .slice(0, length);

      if (pasted) {
        onChange(pasted);
        focusInput(Math.min(pasted.length, length - 1));
      }
    },
    [onChange, length, focusInput]
  );

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={clsx(
            'h-12 w-10 rounded-lg border text-center text-lg font-semibold sm:h-14 sm:w-12 sm:text-xl',
            'bg-white dark:bg-white/5',
            'text-zinc-950 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-brand-green',
            'disabled:opacity-50',
            invalid
              ? 'border-red-500 dark:border-red-600'
              : 'border-zinc-300 dark:border-white/20'
          )}
        />
      ))}
    </div>
  );
}
