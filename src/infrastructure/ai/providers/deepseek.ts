import { createDeepSeek } from '@ai-sdk/deepseek';

export function getDeepSeekModel() {
  return createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  })('deepseek-chat');
}
