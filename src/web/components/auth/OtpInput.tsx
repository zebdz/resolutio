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
    (index: number, char: string) => {
      if (!/^\d?$/.test(char)) {return;}

      const newDigits = [...digits];
      newDigits[index] = char;
      const newValue = newDigits.join('').replace(/\s/g, '');
      onChange(newValue);

      if (char && index < length - 1) {
        focusInput(index + 1);
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
