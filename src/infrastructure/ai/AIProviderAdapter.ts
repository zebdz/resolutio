import { streamText, Output } from 'ai';
import type { z } from 'zod';
import type {
  AIProviderPort,
  StreamAnalysisResult,
} from '@/domain/ai/AIProviderPort';
import { getDeepSeekModel } from './providers/deepseek';
import { getGoogleModel } from './providers/google';

type ModelFactory = () => ReturnType<typeof getDeepSeekModel>;

const MODEL_REGISTRY: Record<string, ModelFactory> = {
  deepseek: getDeepSeekModel,
  google: getGoogleModel,
};

export const AVAILABLE_MODELS = Object.keys(MODEL_REGISTRY);

export class AIProviderAdapter implements AIProviderPort {
  streamAnalysis<T>(params: {
    model: string;
    schema: z.ZodType<T>;
    system: string;
    prompt: string;
  }): StreamAnalysisResult<T> {
    const modelFactory = MODEL_REGISTRY[params.model];

    if (!modelFactory) {
      throw new Error(`Unknown model: ${params.model}`);
    }

    const result = streamText({
      model: modelFactory(),
      system: params.system,
      prompt: params.prompt,
      output: Output.object({ schema: params.schema }),
    });

    return {
      partialOutputStream: result.partialOutputStream as AsyncIterable<
        T | undefined
      >,
      output: result.output as PromiseLike<T>,
      usage: result.usage.then((u) => ({
        promptTokens: u.inputTokens ?? 0,
        completionTokens: u.outputTokens ?? 0,
      })),
    };
  }
}
