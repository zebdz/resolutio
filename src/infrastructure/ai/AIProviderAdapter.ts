import type { LanguageModel } from 'ai';
import { AVAILABLE_MODEL_KEYS } from '@/application/ai/modelRegistry';
import { getDeepSeekModel } from './providers/deepseek';
import { getGoogleModel } from './providers/google';

type ModelFactory = () => LanguageModel;

const MODEL_REGISTRY: Record<string, ModelFactory> = {
  deepseek: getDeepSeekModel,
  google: getGoogleModel,
};

// Re-exported so callers (e.g. route handlers) only import from one place.
export const AVAILABLE_MODELS = AVAILABLE_MODEL_KEYS;

export class AIProviderAdapter {
  getModel(modelKey: string): LanguageModel {
    const factory = MODEL_REGISTRY[modelKey];

    if (!factory) {
      throw new Error(`Unknown model: ${modelKey}`);
    }

    return factory();
  }
}
