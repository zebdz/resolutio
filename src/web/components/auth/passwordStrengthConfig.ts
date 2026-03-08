type StrengthLevel = {
  color: string;
  labelKey: string;
};

export const STRENGTH_LEVELS: StrengthLevel[] = [
  { color: 'bg-red-500', labelKey: 'veryWeak' },
  { color: 'bg-orange-500', labelKey: 'weak' },
  { color: 'bg-yellow-500', labelKey: 'fair' },
  { color: 'bg-lime-500', labelKey: 'strong' },
  { color: 'bg-green-500', labelKey: 'veryStrong' },
];

export function getStrengthConfig(
  password: string,
  score?: number | null
): { color: string; labelKey: string; percentage: number } | null {
  if (!password) {
    return null;
  }

  if (score === null || score === undefined) {
    return null;
  }

  const level = STRENGTH_LEVELS[score];

  return {
    color: level.color,
    labelKey: level.labelKey,
    percentage: ((score + 1) / 5) * 100,
  };
}
