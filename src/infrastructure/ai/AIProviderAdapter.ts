/** Provider lookup consumes a validated stable model key; SDK types stay in infrastructure. */
import { AIModelKey } from '@/domain/ai/LegalAnalysis';
import type { LanguageModel } from 'ai';
import { LEGAL_CHECK_MODEL } from '@/application/ai/modelRegistry';
import { getDeepSeekModel } from './providers/deepseek';

type ModelFactory = () => LanguageModel;

const MODEL_REGISTRY: Record<string, ModelFactory> = {
  [LEGAL_CHECK_MODEL.key]: getDeepSeekModel,
};

export class AIProviderAdapter {
  getModel(modelKey: AIModelKey): LanguageModel {
    const factory = MODEL_REGISTRY[modelKey];

    if (!factory) {
      throw new Error(`Unknown model: ${modelKey}`);
    }

    return factory();
  }
}
