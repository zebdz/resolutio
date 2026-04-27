// Shared error/warning banner. Replaces the old `<Text className="text-red-600">`
// pattern, which silently rendered as gray because Catalyst's Text component
// appends its own zinc text-color classes AFTER the caller's, and equal-
// specificity Tailwind utilities resolve by source order — Catalyst always won.
//
// This component renders a plain block (no Text wrapper) so the color we set
// is the color the user sees, plus a colored background + icon-style left
// border so feedback is unmistakable rather than easy to miss.

import clsx from 'clsx';

type Tone = 'error' | 'warning';

interface Props {
  // The localized message to display. Pass `null`/empty to render nothing.
  message: string | null | undefined;
  // 'error' = red (failed action). 'warning' = amber (cooldown, blocked
  // re-submit, validation hint). Default: 'error'.
  tone?: Tone;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  error:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
};

export function ErrorBanner({ message, tone = 'error', className }: Props) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={clsx(
        'rounded-md border p-3 text-sm font-medium',
        TONE_CLASSES[tone],
        className
      )}
    >
      {message}
    </div>
  );
}
