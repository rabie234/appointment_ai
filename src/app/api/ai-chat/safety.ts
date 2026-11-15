
export type SafetyDecision =
  | { action: 'urgent'; message: string }
  | { action: 'clarify'; message: string }
  | { action: 'continue' };

type Language = 'ar' | 'en' | 'fr';

const URGENT_PATTERNS: RegExp[] = [
  // English
  /\b(chest pain|chest pressure|crushing chest pain)\b/i,
  /\b(can't breathe|cannot breathe|severe shortness of breath)\b/i,
  /\b(fainting|unconscious|not responding)\b/i,
  /\b(sudden weakness|face drooping|trouble speaking)\b/i,

  // Arabic
  /(ألم الصدر|ألم في الصدر|وجع الصدر|وجع بالصدر|وجع بصدري|ضغط في الصدر)/u,
  /(ضيق التنفس|ضيق نفس|صعوبة في التنفس|مش قادر أتنفس|مش قادرة أتنفس|ما فيني أتنفس)/u,
  /(إغماء|فقدان الوعي|فاقد الوعي|مش واعي|مش واعية)/u,
  /(ضعف مفاجئ|تدلي الوجه|صعوبة في الكلام|مش قادر أحكي|مش قادرة أحكي)/u,

  // French
  /\b(chest pain)\b/i,
  /\b(douleur thoracique|douleur à la poitrine|douleur dans la poitrine|pression thoracique)\b/i,
  /\b(difficulté à respirer|difficultés respiratoires|essoufflement sévère)\b/i,
  /\b(perte de connaissance|évanouissement|inconscient|inconsciente)\b/i,
  /\b(faiblesse soudaine|visage affaissé|difficulté à parler)\b/i,
];

const PAST_OR_NEGATED_PATTERNS: RegExp[] = [
  // English: examples of explicit negation or past context
  /\b(no|not|never|without)\b.*\b(chest pain|chest pressure)\b/i,
  /\b(had|experienced|used to have)\b.*\b(chest pain|chest pressure)\b.*\b(last week|yesterday|last month|years ago|in the past)\b/i,
  /\b(chest pain|chest pressure)\b.*\b(last week|yesterday|last month|years ago|in the past)\b/i,

  // Arabic: explicit negation or past context
  /(ما عندي|ليس لدي|لم أعانِ من|ما عاد عندي).*(وجع بالصدر|وجع الصدر|ألم الصدر|ألم في الصدر)/u,
  /(كان عندي|صار معي|عانيت من).*(وجع بالصدر|وجع الصدر|ألم الصدر|ألم في الصدر).*(الأسبوع الماضي|مبارح|أمس|من قبل)/u,

  // French: explicit negation or past context
  /\b(pas de|aucun|sans)\b.*\b(douleur thoracique|douleur à la poitrine)\b/i,
  /\b(j'avais|j’ai eu|j'ai eu)\b.*\b(douleur thoracique|douleur à la poitrine)\b.*\b(la semaine dernière|hier|le mois dernier|autrefois)\b/i,
];

function detectLanguage(text: string): Language {
  if (/[\u0600-\u06FF]/u.test(text)) {
    return 'ar';
  }

  if (
    /\b(douleur|poitrine|respirer|essoufflement|inconscient|faiblesse|parler|bonjour|rendez-vous)\b/i.test(
      text
    ) ||
    /[àâçéèêëîïôùûüÿœæ]/i.test(text)
  ) {
    return 'fr';
  }

  return 'en';
}

const MESSAGES: Record<Language, { urgent: string; clarify: string }> = {
  en: {
    urgent:
      'These symptoms may need urgent medical evaluation. If they are happening now or are severe, seek emergency medical help immediately. Do not delay urgent care to book a routine appointment.',
    clarify:
      'Could you tell me where the pain is, when it started, how severe it is, and whether you have any other symptoms?',
  },
  ar: {
    urgent:
      'الأعراض التي تصفها قد تحتاج إلى تقييم طبي عاجل. إذا كانت تحدث الآن أو كانت شديدة، اطلب المساعدة الطبية الطارئة فورًا. لا تؤخّر طلب المساعدة من أجل حجز موعد عادي.',
    clarify:
      'فيني اسألك وين مكان الوجع، من إمتى بلّش، قديش شدّته، وإذا في أعراض تانية معه؟',
  },
  fr: {
    urgent:
      'Ces symptômes peuvent nécessiter une évaluation médicale urgente. S’ils se produisent maintenant ou sont sévères, contactez immédiatement les services d’urgence. Ne retardez pas les soins urgents pour prendre un rendez-vous ordinaire.',
    clarify:
      'Où se situe la douleur, quand a-t-elle commencé, quelle est son intensité et avez-vous d’autres symptômes ?',
  },
};

export function assessSafety(message: string): SafetyDecision {
  const text = message.trim();

  if (!text) {
    return {
      action: 'clarify',
      message: MESSAGES.en.clarify,
    };
  }

  const language = detectLanguage(text);

  const hasUrgentSignal = URGENT_PATTERNS.some((pattern) =>
    pattern.test(text)
  );

  const hasPastOrNegatedContext = PAST_OR_NEGATED_PATTERNS.some(
    (pattern) => pattern.test(text)
  );

  // Possible urgent symptoms take priority.
  // These simple patterns cannot reliably understand all context.
  if (hasUrgentSignal && !hasPastOrNegatedContext) {
    return {
      action: 'urgent',
      message: MESSAGES[language].urgent,
    };
  }

  // Let normal requests continue to the AI assistant.
  const isAppointmentRequest =
    /\b(book|appointment|dermatologist|doctor)\b/i.test(text) ||
    /(احجز|حجز|موعد|طبيب|دكتور)/u.test(text) ||
    /\b(rendez-vous|médecin|dermatologue)\b/i.test(text);

  if (isAppointmentRequest) {
    return { action: 'continue' };
  }

  // Symptoms that aren't matched as urgent need clarification.
  return {
    action: 'clarify',
    message: MESSAGES[language].clarify,
  };
}
