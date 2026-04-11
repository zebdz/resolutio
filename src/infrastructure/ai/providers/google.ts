import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { requireAIModelInfo } from '@/application/ai/modelRegistry';

export function getGoogleModel() {
  return createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_KEY,
  })(requireAIModelInfo('google').modelId);
}
