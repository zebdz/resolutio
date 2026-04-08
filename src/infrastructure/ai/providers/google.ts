import { createGoogleGenerativeAI } from '@ai-sdk/google';

export function getGoogleModel() {
  return createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_KEY,
  })('gemini-2.0-flash');
}
