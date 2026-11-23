/** Bind new legality checks to the active DeepSeek API model. */
import { createDeepSeek } from '@ai-sdk/deepseek';
import { LEGAL_CHECK_MODEL } from '@/application/ai/modelRegistry';

export function getDeepSeekModel() {
  return createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  })(LEGAL_CHECK_MODEL.modelId);
}
