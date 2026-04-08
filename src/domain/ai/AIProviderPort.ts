import type { z } from 'zod';

export interface StreamAnalysisResult<T> {
  partialOutputStream: AsyncIterable<T | undefined>;
  output: PromiseLike<T>;
  usage: PromiseLike<{ promptTokens: number; completionTokens: number }>;
}

export interface AIProviderPort {
  streamAnalysis<T>(params: {
    model: string;
    schema: z.ZodType<T>;
    system: string;
    prompt: string;
  }): StreamAnalysisResult<T>;
}
