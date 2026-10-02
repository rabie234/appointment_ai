import { GoogleGenAI } from '@google/genai';

/**
 * Server-only Gemini client. The API key never leaves the server — the AI chat
 * runs entirely inside a server action, so the browser never sees this.
 */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Please define the GEMINI_API_KEY environment variable inside .env');
}

/**
 * Single point of change for the model. Flash-Lite is the cheapest/fastest tier;
 * if symptom→specialty routing or multi-step function calling proves unreliable,
 * bump this to the current Flash tier (e.g. 'gemini-2.5-flash').
 */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
