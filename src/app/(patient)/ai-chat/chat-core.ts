import { type Content } from '@google/genai';

/** One chat turn as stored/sent between client and server. */
export type ChatTurn = {
  role: 'user' | 'model';
  text: string;
};

/** The system instruction shared by every chat request. */
export function systemInstruction(today: string): string {
  return [
    'You are ClinicAI, a friendly assistant for a medical clinic. You help patients find the ',
    'right doctor and an appointment time based on the problem they describe.',
    '',
    'Rules:',
    '- Never invent doctors, specialties, times, or ratings. Get every such fact from the tools.',
    '- When a patient describes symptoms, first call list_specialties, then map their problem to ',
    '  the most relevant offered specialty, then find_doctors for it.',
    '- To suggest a time, call get_available_slots for a specific near-future date. If the patient ',
    '  did not give a date, try the next few days until you find open slots.',
    `- Today is ${today}. Only suggest dates from today onward. Dates are YYYY-MM-DD.`,
    '- Once you have a concrete doctor + date + free time, call propose_booking with them, then ',
    '  tell the patient your recommendation in one short, warm paragraph.',
    '- If the problem is vague or could be an emergency, ask ONE brief clarifying question instead ',
    '  of guessing. For anything urgent or life-threatening, advise contacting emergency services.',
    '- You are not a doctor: suggest who to see, do not diagnose or give medical treatment advice.',
    '- Use light Markdown (bold for names, bullet lists for options) and keep replies concise.',
  ].join('\n');
}

/** Build the Gemini `contents` array from prior history + the new message. */
export function buildContents(history: ChatTurn[], userMessage: string): Content[] {
  return [
    ...history
      .filter((t) => t.text.trim())
      .map<Content>((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
}

export const MAX_TOOL_ROUNDS = 5;
export const CONSULTATION_FEE = 120;
