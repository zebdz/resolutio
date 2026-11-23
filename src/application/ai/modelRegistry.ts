/** Active model for new legality checks and display metadata for stored analyses.
 * Both server validation and the client control use the same active model.
 */

import { AIModelKey, ProviderModelId } from '@/domain/ai/LegalAnalysis';

export interface AIModelInfo {
  key: AIModelKey;
  modelId: ProviderModelId;
  displayName: string;
}

export const LEGAL_CHECK_MODEL: AIModelInfo = {
  key: AIModelKey.parse('deepseek-flash'),
  modelId: ProviderModelId.parse('deepseek-flash'),
  displayName: 'DeepSeek V4.1 Flash',
};

const historicalModels: readonly AIModelInfo[] = [
  LEGAL_CHECK_MODEL,
  {
    key: AIModelKey.parse('deepseek'),
    modelId: ProviderModelId.parse('deepseek-chat'),
    displayName: 'DeepSeek V3',
  },
  {
    key: AIModelKey.parse('google'),
    modelId: ProviderModelId.parse('gemini-2.5-flash'),
    displayName: 'Gemini 2.5 Flash',
  },
];

// Older open browser tabs still submit the original provider key.
export function resolveLegalCheckModel(key: unknown): AIModelKey | undefined {
  return key === LEGAL_CHECK_MODEL.key || key === 'deepseek'
    ? LEGAL_CHECK_MODEL.key
    : undefined;
}

export function getAIModelInfo(key: string): AIModelInfo | undefined {
  return historicalModels.find((model) => model.key === key);
}

export function requireAIModelInfo(key: string): AIModelInfo {
  const info = getAIModelInfo(key);

  if (!info) {
    throw new Error(`Unknown AI model key: ${key}`);
  }

  return info;
}
