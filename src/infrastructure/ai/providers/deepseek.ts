import { createDeepSeek } from '@ai-sdk/deepseek';
import { requireAIModelInfo } from '@/application/ai/modelRegistry';

export function getDeepSeekModel() {
  return createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  })(requireAIModelInfo('deepseek').modelId);
}
