/**
 * Single source of truth for AI model metadata.
 *
 * The `key` is the stable identifier stored in the DB and passed between
 * server/client. The `modelId` is the provider-specific string consumed by
 * the Vercel AI SDK (e.g. 'gemini-2.5-flash'). The `displayName` is the
 * human-facing label shown in the UI — brand names, not localized.
 *
 * To upgrade a model version (e.g. Gemini 2.5 → 3.0), change the `modelId`
 * and `displayName` here; everything else propagates automatically.
 *
 * This module contains no server-only imports, so it is safe to import from
 * client components.
 */

export interface AIModelInfo {
  key: string;
  modelId: string;
  displayName: string;
}

export const AI_MODELS: readonly AIModelInfo[] = [
  {
    key: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  },
  {
    key: 'deepseek',
    modelId: 'deepseek-chat',
    displayName: 'DeepSeek V3',
  },
];

export const AVAILABLE_MODEL_KEYS: readonly string[] = AI_MODELS.map(
  (m) => m.key
);

export function getAIModelInfo(key: string): AIModelInfo | undefined {
  return AI_MODELS.find((m) => m.key === key);
}

export function requireAIModelInfo(key: string): AIModelInfo {
  const info = getAIModelInfo(key);

  if (!info) {
    throw new Error(`Unknown AI model key: ${key}`);
  }

  return info;
}
