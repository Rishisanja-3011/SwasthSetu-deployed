const LANGUAGE_ALIASES = {
  en: 'en', 'en-us': 'en', 'en-in': 'en', english: 'en',
  gu: 'gu', 'gu-in': 'gu', gujarati: 'gu', 'ગુજરાતી': 'gu',
  hi: 'hi', 'hi-in': 'hi', hindi: 'hi', 'हिन्दी': 'hi', 'हिंदी': 'hi',
  mr: 'mr', 'mr-in': 'mr', marathi: 'mr', 'मराठी': 'mr',
  ta: 'ta', 'ta-in': 'ta', tamil: 'ta', 'தமிழ்': 'ta',
  te: 'te', 'te-in': 'te', telugu: 'te', 'తెలుగు': 'te',
  kn: 'kn', 'kn-in': 'kn', kannada: 'kn', 'ಕನ್ನಡ': 'kn',
  ml: 'ml', 'ml-in': 'ml', malayalam: 'ml', 'മലയാളം': 'ml',
  bn: 'bn', 'bn-in': 'bn', bengali: 'bn', 'বাংলা': 'bn',
  pa: 'pa', 'pa-in': 'pa', punjabi: 'pa', 'ਪੰਜਾਬੀ': 'pa',
};

const SUPPORTED_LANGUAGES = new Set(Object.values(LANGUAGE_ALIASES));

function normalizeLanguage(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return fallback;
  const base = normalized.split('-', 1)[0];
  if (Object.hasOwn(LANGUAGE_ALIASES, normalized)) return LANGUAGE_ALIASES[normalized];
  return Object.hasOwn(LANGUAGE_ALIASES, base) ? LANGUAGE_ALIASES[base] : fallback;
}

const scriptMatchers = [
  ['gu', /[\u0A80-\u0AFF]/g],
  ['hi', /[\u0900-\u097F]/g],
  ['ta', /[\u0B80-\u0BFF]/g],
  ['te', /[\u0C00-\u0C7F]/g],
  ['kn', /[\u0C80-\u0CFF]/g],
  ['ml', /[\u0D00-\u0D7F]/g],
  ['bn', /[\u0980-\u09FF]/g],
  ['pa', /[\u0A00-\u0A7F]/g],
];

const MARATHI_CUES = /(?<![\p{L}\p{M}])(?:मला|माझे|माझा|आहे|पासून|दिवस|ताप|अंगदुखी|डोकेदुखी|मळमळ|खोकला|घसा|दुखत|होत)(?![\p{L}\p{M}])/iu;
const HINDI_CUES = /(?<![\p{L}\p{M}])(?:मुझे|मेरा|मेरी|है|से|दिन|बुखार|दर्द|चक्कर|खांसी|सांस|गले|उल्टी)(?![\p{L}\p{M}])/iu;
const ENGLISH_CUES = /\b(i|have|has|my|the|for|since|days?|weeks?|fever|pain|cough|headache|dizzy|weakness|allergy)\b/i;

function countMatches(text, matcher) {
  const matches = text.match(matcher);
  return matches ? matches.length : 0;
}

/**
 * Detect the language without allowing the selected language to overwrite the
 * observed language. The selected language remains a recognition/extraction
 * hint; this value describes the statement we actually received.
 */
function detectLanguage(text, preferredLanguage = null) {
  const clean = typeof text === 'string' ? text : '';
  const scriptScores = scriptMatchers
    .map(([language, matcher]) => ({ language, score: countMatches(clean, matcher) }))
    .sort((a, b) => b.score - a.score);
  const strongest = scriptScores[0];

  if (strongest && strongest.score > 0) {
    if (strongest.language === 'hi' && MARATHI_CUES.test(clean)) {
      return { language: 'mr', confidence: 0.84, source: 'AI_DETECTED' };
    }
    if (strongest.language === 'hi' && HINDI_CUES.test(clean)) {
      return { language: 'hi', confidence: 0.90, source: 'AI_DETECTED' };
    }
    return {
      language: strongest.language,
      confidence: strongest.score > 2 ? 0.96 : 0.82,
      source: 'AI_DETECTED',
    };
  }

  if (ENGLISH_CUES.test(clean)) {
    return { language: 'en', confidence: 0.86, source: 'AI_DETECTED' };
  }

  const normalizedPreferred = normalizeLanguage(preferredLanguage, null);
  if (normalizedPreferred) {
    return { language: normalizedPreferred, confidence: 0.50, source: 'USER_SELECTED' };
  }
  return { language: '', confidence: 0, source: 'UNKNOWN' };
}

module.exports = {
  LANGUAGE_ALIASES,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  detectLanguage,
};
