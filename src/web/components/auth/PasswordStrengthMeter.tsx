'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Text } from '@/app/components/catalyst/text';
import { getStrengthConfig } from './passwordStrengthConfig';

type Props = {
  password: string;
};

export function PasswordStrengthMeter({ password }: Props) {
  const t = useTranslations('auth.register.passwordStrength');
  const [score, setScore] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!password) {
      setScore(null);

      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      const [{ zxcvbn, zxcvbnOptions }, common] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
      ]);
      zxcvbnOptions.setOptions({
        dictionary: { ...common.dictionary },
        graphs: common.adjacencyGraphs,
      });
      const result = zxcvbn(password);
      setScore(result.score);
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [password]);

  const config = getStrengthConfig(password, score);

  if (!config) {return null;}

  return (
    <div className="mt-1 space-y-1">
      <div className="h-1.5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full ${config.color} transition-all duration-300 rounded-full`}
          style={{ width: `${config.percentage}%` }}
        />
      </div>
      <Text className="text-xs">{t(config.labelKey)}</Text>
    </div>
  );
}
