const { detectLanguage, normalizeLanguage } = require('./languageService');

const PIPELINE_VERSION = 'clinical-intake-v1';
const EMPTY_CLINICAL_INTAKE = {
  chief_complaint: '',
  duration: '',
  symptoms: [],
  negative_symptoms: [],
  possible_symptom_categories: [],
  relevant_history: [],
  medications: [],
  allergies: [],
  allergy_status: 'UNKNOWN',
  urgency: '',
};
const URGENCY_VALUES = new Set(['LOW', 'MODERATE', 'HIGH', 'EMERGENCY']);
const ALLERGY_STATUS_VALUES = new Set(['REPORTED', 'NONE_REPORTED', 'UNKNOWN']);
const CATEGORIES = {
  GENERAL_SYSTEMIC: 'GENERAL_SYSTEMIC',
  RESPIRATORY: 'RESPIRATORY',
  GASTROINTESTINAL: 'GASTROINTESTINAL',
  NEUROLOGICAL: 'NEUROLOGICAL',
  MUSCULOSKELETAL: 'MUSCULOSKELETAL',
  DERMATOLOGICAL: 'DERMATOLOGICAL',
  CARDIOVASCULAR: 'CARDIOVASCULAR',
};
const ALLOWED_CATEGORIES = new Set(Object.values(CATEGORIES));

// These are explicit phrase matches, not a diagnosis vocabulary. A phrase is
// added only when the patient actually states it in the original message.
const SYMPTOM_PATTERNS = [
  { value: 'difficulty breathing', category: CATEGORIES.RESPIRATORY, patterns: [
    'difficulty breathing', 'breathing difficulty', 'shortness of breath',
    'શ્વાસ લેવામાં તકલીફ', 'શ્વાસ લેવામાં મુશ્કેલી', 'સાંસ લેવામાં તકલીફ',
    'सांस लेने में परेशानी', 'सांस लेने में दिक्कत', 'श्वास घेण्यास त्रास',
  ] },
  { value: 'chest pain', category: CATEGORIES.CARDIOVASCULAR, patterns: [
    'chest pain', 'છાતીમાં દુખાવો', 'छाती में दर्द', 'छातीत दुखत',
  ] },
  { value: 'stomach pain', category: CATEGORIES.GASTROINTESTINAL, patterns: [
    'stomach pain', 'abdominal pain', 'પેટમાં દુખાવો', 'પેટમાં દુખાવું',
    'पेट में दर्द', 'पोटात दुखत', 'पोटात दुखणे',
  ] },
  { value: 'sore throat', category: CATEGORIES.RESPIRATORY, patterns: [
    'sore throat', 'ગળામાં દુખાવો', 'ગળું દુખે', 'गले में दर्द', 'घसा दुखतो',
  ] },
  { value: 'headache', category: CATEGORIES.NEUROLOGICAL, patterns: [
    'headache', 'માથાનો દુખાવો', 'માથામાં દુખાવો', 'सिर में दर्द',
    'माथे में दर्द', 'डोकेदुखी', 'डोक्यात दुखत',
  ] },
  { value: 'dizziness', category: CATEGORIES.NEUROLOGICAL, patterns: [
    'dizziness', 'dizzy', 'ચક્કર', 'गरगरणे', 'चक्कर', 'चक्कर येणे',
  ] },
  { value: 'weakness', category: CATEGORIES.GENERAL_SYSTEMIC, patterns: [
    'weakness', 'weak', 'fatigue', 'tiredness', 'કમજોરી', 'થાક',
    'कमजोरी', 'थकान', 'अशक्तपणा', 'दमणूक',
  ] },
  { value: 'fever', category: CATEGORIES.GENERAL_SYSTEMIC, patterns: [
    'fever', 'તાવ', 'બુખાર', 'बुखार', 'ताप',
  ] },
  { value: 'body ache', category: CATEGORIES.MUSCULOSKELETAL, patterns: [
    'body ache', 'body pain', 'શરીરમાં દુખાવો', 'અંગમાં દુખાવો',
    'बदन दर्द', 'शरीर में दर्द', 'अंगदुखी', 'अंग दुखणे',
  ] },
  { value: 'cough', category: CATEGORIES.RESPIRATORY, patterns: [
    'cough', 'ઉધરસ', 'ખાંસી', 'खांसी', 'खोकला',
  ] },
  { value: 'nausea', category: CATEGORIES.GASTROINTESTINAL, patterns: [
    'nausea', 'feeling sick', 'ઉબકા', 'મિતલી', 'मितली', 'मळमळ',
  ] },
  { value: 'vomiting', category: CATEGORIES.GASTROINTESTINAL, patterns: [
    'vomiting', 'vomit', 'ઉલટી', 'उल्टी', 'उलटी',
  ] },
  { value: 'diarrhea', category: CATEGORIES.GASTROINTESTINAL, patterns: [
    'diarrhea', 'loose motions', 'ઝાડા', 'दस्त', 'जुलाब',
  ] },
  { value: 'rash', category: CATEGORIES.DERMATOLOGICAL, patterns: [
    'rash', 'skin rash', 'ચામડી પર ચકામા', 'ચકામા', 'चकत्ते', 'पुरळ',
  ] },
  { value: 'itching', category: CATEGORIES.DERMATOLOGICAL, patterns: [
    'itching', 'itchy', 'ખંજવાળ', 'खुजली', 'खाज',
  ] },
  { value: 'joint pain', category: CATEGORIES.MUSCULOSKELETAL, patterns: [
    'joint pain', 'સાંધામાં દુખાવો', 'जोड़ों में दर्द', 'सांध्यात दुखत',
  ] },
  { value: 'back pain', category: CATEGORIES.MUSCULOSKELETAL, patterns: [
    'back pain', 'કમરનો દુખાવો', 'कमर में दर्द', 'कंबरदुखी',
  ] },
  { value: 'bleeding', category: CATEGORIES.GENERAL_SYSTEMIC, patterns: [
    'bleeding', 'blood in stool', 'લોહી આવે', 'खून आना', 'रक्तस्राव',
  ] },
];

const NEGATION_PATTERNS = [
  /\bno\s+(?:known\s+)?/i,
  /\bwithout\s+/i,
  /\bnot\s+(?:having\s+)?/i,
  /\bdenies?\s+/i,
  /નથી|નહીં|નહિ/u,
  /નથી થતો|નથી આવતો/u,
  /नहीं|नही|नाही/u,
];

const ALLERGY_NEGATIVE_PATTERNS = [
  /no known allergies?/i,
  /no allergies?/i,
  /\bnot allergic(?:\s+to anything)?\s*(?:[.!?;]|$)/i,
  /મને કોઈ એલર્જી નથી/u,
  /કોઈ એલર્જી નથી/u,
  /कोई एलर्जी नहीं/u,
  /कोणतीही ऍलर्जी नाही/u,
];

const ALLERGY_PATTERNS = [
  ['penicillin', /(?:allergic to|allergy to|allergy from)\s+penicillin|penicillin\s+allergy/i],
  ['aspirin', /(?:allergic to|allergy to|allergy from)\s+aspirin|aspirin\s+allergy/i],
  ['ibuprofen', /(?:allergic to|allergy to|allergy from)\s+ibuprofen|ibuprofen\s+allergy/i],
  ['peanuts', /(?:allergic to|allergy to)\s+(?:peanuts?|groundnuts?)/i],
  ['penicillin', /પેનિસિલિનથી એલર્જી|पेनिसिलिन से एलर्जी|पेनिसिलिनची ऍलर्जी/u],
];

const MEDICATION_PATTERNS = [
  ['paracetamol', /(?:taking|took|on)\s+paracetamol|paracetamol\s+(?:લીધી|લઉં છું|ले रहा|घेतो)/i],
  ['ibuprofen', /(?:taking|took|on)\s+ibuprofen/i],
  ['metformin', /(?:taking|took|on)\s+metformin/i],
  ['aspirin', /(?:taking|took|on)\s+aspirin/i],
];

const HISTORY_PATTERNS = [
  ['diabetes', /(?:history of|known with|have)\s+diabetes|diabetesનો ઇતિહાસ|मधुमेह का इतिहास|मधुमेहाचा इतिहास/i],
  ['hypertension', /(?:history of|known with|have)\s+(?:high blood pressure|hypertension)|બ્લડ પ્રેશરનો ઇતિહાસ|उच्च रक्तचाप का इतिहास/i],
  ['asthma', /(?:history of|known with|have)\s+asthma|અસ્થમાનો ઇતિહાસ|अस्थमा का इतिहास/i],
];

const DURATION_UNITS = {
  day: 'day', days: 'day', week: 'week', weeks: 'week', month: 'month', months: 'month',
  દિવસ: 'day', દિવસથી: 'day', दिन: 'day', दिनों: 'day', दिवस: 'day', दिवसांपासून: 'day',
};
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  એક: 1, બે: 2, ત્રણ: 3, ચાર: 4, પાંચ: 5,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5,
};

function cleanList(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function includesPattern(text, pattern) {
  if (pattern instanceof RegExp) return pattern.test(text);
  return text.toLocaleLowerCase().includes(pattern.toLocaleLowerCase());
}

function isNegated(text, matchIndex, matchLength = 0) {
  const prefix = text.slice(Math.max(0, matchIndex - 80), matchIndex)
    .split(/[.!?;\n।]|\bbut\b|\bhowever\b|પરંતુ|लेकिन|\band\s+(?:i\s+)?(?:have|am)\b/iu).pop();
  const negationIndex = NEGATION_PATTERNS.reduce((latest, pattern) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const matches = [...prefix.matchAll(new RegExp(pattern.source, flags))];
    const match = matches[matches.length - 1];
    return match && typeof match.index === 'number' ? Math.max(latest, match.index) : latest;
  }, -1);
  if (negationIndex >= 0) {
    const afterNegation = prefix.slice(negationIndex);
    if (afterNegation.includes('\u092a\u0923') || afterNegation.includes('\u0aaa\u0aa3')) return false;
    if (!/(?:અને|और|आणि)/u.test(afterNegation)) return true;
  }

  // In several supported languages the negative particle follows the
  // symptom (for example, "बुखार नहीं है" or "તાવ નથી"). Only accept that
  // form when it is immediately after the matched symptom; a later "no
  // cough" in "fever and no cough" must not negate fever.
  const suffix = text.slice(matchIndex + matchLength, matchIndex + matchLength + 48);
  return /^\s*(?:is|are|होता|होती|है|છે)?\s*(?:not\b|नहीं|नही|नाही|નથી|નહીં)/iu.test(suffix);
}

function findPatternIndex(text, pattern) {
  if (pattern instanceof RegExp) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const match = new RegExp(pattern.source, flags).exec(text);
    return match ? match.index : -1;
  }
  // English phrases must be words: "rash" in "crash" is not a symptom.
  if (/^[a-z ]+$/i.test(pattern)) return text.search(new RegExp(`\\b${pattern}\\b`, 'i'));
  return text.toLocaleLowerCase().indexOf(pattern.toLocaleLowerCase());
}

function extractSymptoms(text) {
  const symptoms = [];
  const negativeSymptoms = [];
  const categories = [];

  for (const item of SYMPTOM_PATTERNS) {
    const matchedPattern = item.patterns.find((pattern) => findPatternIndex(text, pattern) >= 0);
    const matchIndex = matchedPattern === undefined ? -1 : findPatternIndex(text, matchedPattern);
    if (matchIndex === undefined || matchIndex < 0) continue;
    const match = matchedPattern instanceof RegExp
      ? new RegExp(matchedPattern.source, matchedPattern.flags.replace('g', '')).exec(text.slice(matchIndex))
      : null;
    const matchLength = match?.[0]?.length || String(matchedPattern).length;
    if (isNegated(text, matchIndex, matchLength)) negativeSymptoms.push(item.value);
    else {
      symptoms.push(item.value);
      categories.push(item.category);
    }
  }
  return {
    symptoms: cleanList(symptoms),
    negativeSymptoms: cleanList(negativeSymptoms),
    categories: cleanList(categories),
  };
}

function normalizeDurationNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  return NUMBER_WORDS[value.toLocaleLowerCase()] || null;
}

function extractDuration(text) {
  const lower = text.toLocaleLowerCase().replace(/[૦-૯०-९]/gu, (digit) => String(digit.charCodeAt(0) - (digit >= '૦' ? 0x0AE6 : 0x0966)));
  const numeric = /(?:for|since|past|last|થી|से|पासून)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|એક|બે|ત્રણ|ચાર|પાંચ|एक|दो|तीन|चार|पांच|पाँच)\s*(day|days|week|weeks|month|months|દિવસ|દિવસથી|दिन|दिवस|दिवसांपासून)/iu.exec(lower);
  const regionalDuration = /(\d+|one|two|three|four|five|six|એક|બે|ત્રણ|ચાર|પાંચ|एक|दो|तीन|चार|पांच|पाँच)\s*(day|days|week|weeks|month|months|દિવસ|દિવસથી|दिन|दिवस|दिवसांपासून)/iu.exec(lower);
  const matchedDuration = numeric || regionalDuration;
  if (matchedDuration) {
    const number = normalizeDurationNumber(matchedDuration[1]);
    const unit = DURATION_UNITS[matchedDuration[2].toLocaleLowerCase()] || matchedDuration[2];
    if (number && unit) return `${number} ${unit}${number === 1 ? '' : 's'}`;
  }
  if (/(?:since|from|થી|से|पासून)\s+(?:yesterday|કાલથી|ગઈકાલથી|कल से|कालपासून)/iu.test(lower)
    || /(yesterday|કાલથી|ગઈકાલથી|कल से|कालपासून)/iu.test(lower)) return 'since yesterday';
  return '';
}

function extractAllergies(text) {
  const allergies = extractNamedValues(text, ALLERGY_PATTERNS);
  if (allergies.length) return { allergies, allergyStatus: 'REPORTED' };
  if (ALLERGY_NEGATIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { allergies: [], allergyStatus: 'NONE_REPORTED' };
  }
  return {
    allergies: cleanList(allergies),
    allergyStatus: allergies.length ? 'REPORTED' : 'UNKNOWN',
  };
}

function extractNamedValues(text, patterns) {
  return cleanList(patterns.filter(([, pattern]) => {
    const match = pattern.exec(text);
    return match && !isNegated(text, match.index, match[0].length);
  }).map(([value]) => value));
}

function extractUrgency(text) {
  // Severity is an explicit statement, not a triage inference from symptoms.
  return extractNamedValues(text, [
    ['EMERGENCY', /(?:\bcall an ambulance\b|\bemergency\b|\bcannot breathe\b|\bcan't breathe\b|શ્વાસ લઈ શકતો નથી|सांस नहीं ले पा रहा|श्वास घेता येत नाही)/iu],
    ['HIGH', /(?:\bsevere\b|ખૂબ જ|તીવ્ર|बहुत तेज|बहुत ज्यादा|तीव्र|अत्यंत)/iu],
    ['MODERATE', /(?:\bmoderate\b|મધ્યમ|मध्यम)/iu],
    ['LOW', /(?:\bmild\b|\bslight\b|હળવો|हल्का|सौम्य)/iu],
  ])[0] || '';
}

function numberOrZero(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function buildConfidence(clinical, transcriptionConfidence, languageConfidence) {
  const confidence = {
    transcription: numberOrZero(transcriptionConfidence),
    language: numberOrZero(languageConfidence),
    chief_complaint: clinical.chief_complaint ? 0.82 : 0,
    symptoms: clinical.symptoms.length ? 0.82 : 0,
    duration: clinical.duration ? 0.90 : 0,
    category: clinical.possible_symptom_categories.length ? 0.78 : 0,
    allergies: clinical.allergy_status !== 'UNKNOWN' ? 0.90 : 0,
    urgency: clinical.urgency ? 0.76 : 0,
    overall: 0,
  };
  const considered = Object.entries(confidence)
    .filter(([key, value]) => key !== 'overall' && value > 0)
    .map(([, value]) => value);
  confidence.overall = considered.length
    ? Number((considered.reduce((sum, value) => sum + value, 0) / considered.length).toFixed(2))
    : 0;
  return confidence;
}

function extractClinicalFields(text) {
  const symptomData = extractSymptoms(text);
  const allergies = extractAllergies(text);
  const clinical = {
    ...EMPTY_CLINICAL_INTAKE,
    chief_complaint: symptomData.symptoms[0] || '',
    duration: extractDuration(text),
    symptoms: symptomData.symptoms,
    negative_symptoms: symptomData.negativeSymptoms,
    possible_symptom_categories: symptomData.categories,
    relevant_history: extractNamedValues(text, HISTORY_PATTERNS),
    medications: extractNamedValues(text, MEDICATION_PATTERNS),
    allergies: allergies.allergies,
    allergy_status: allergies.allergyStatus,
    urgency: extractUrgency(text, symptomData.symptoms),
  };
  return { clinical, hasExplicitInformation: hasClinicalInformation(clinical) };
}

function hasClinicalInformation(clinical) {
  return Boolean(
    clinical.chief_complaint
      || clinical.duration
      || clinical.symptoms.length
      || clinical.negative_symptoms.length
      || clinical.relevant_history.length
      || clinical.medications.length
      || clinical.allergies.length
      || clinical.allergy_status === 'NONE_REPORTED'
      || clinical.urgency,
  );
}

function buildFieldProvenance(clinical, source) {
  return Object.fromEntries(Object.keys(clinical).map((field) => [field, {
    source,
    evidence: clinical[field] && (!Array.isArray(clinical[field]) || clinical[field].length > 0)
      ? ['Explicitly stated in the patient transcript']
      : [],
  }]));
}

function buildClinicalIntake({
  text,
  selectedLanguage,
  inputMode = 'TEXT',
  transcriptSource = 'PATIENT_TYPED',
  detectedLanguage,
  languageConfidence,
  transcriptionConfidence,
  structuredSource = 'DETERMINISTIC_FALLBACK',
  structuredConfidence = null,
}) {
  if (typeof text !== 'string' || !text.trim()) {
    const error = new Error('Patient text cannot be empty.');
    error.code = 'EMPTY_PATIENT_TEXT';
    throw error;
  }
  const selected = normalizeLanguage(selectedLanguage, null);
  if (!selected) {
    const error = new Error('Patient language is not supported.');
    error.code = 'UNSUPPORTED_LANGUAGE';
    throw error;
  }

  const detected = normalizeLanguage(detectedLanguage, null) || detectLanguage(text, selected).language || selected;
  const detection = detectLanguage(text, selected);
  const actualLanguageConfidence = numberOrZero(languageConfidence ?? (detectedLanguage ? detection.confidence : detection.confidence));
  const { clinical, hasExplicitInformation } = extractClinicalFields(text);
  const confidence = structuredConfidence && typeof structuredConfidence === 'object'
    ? Object.fromEntries(Object.entries({
      ...buildConfidence(clinical, transcriptionConfidence ?? (inputMode === 'TEXT' ? 1 : 0.75), actualLanguageConfidence),
      ...structuredConfidence,
    }).map(([key, value]) => [key, numberOrZero(value)]))
    : buildConfidence(clinical, transcriptionConfidence ?? (inputMode === 'TEXT' ? 1 : 0.75), actualLanguageConfidence);
  if (!confidence.overall) {
    const values = Object.entries(confidence)
      .filter(([key, value]) => key !== 'overall' && value > 0)
      .map(([, value]) => value);
    confidence.overall = values.length
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
      : 0;
  }
  const extractionStatus = hasExplicitInformation ? 'READY' : 'REVIEW_REQUIRED';

  return {
    schema_version: PIPELINE_VERSION,
    selected_language: selected,
    detected_language: detected,
    language_match: Boolean(selected && detected && selected === detected),
    language_confidence: actualLanguageConfidence,
    transcript: {
      text,
      source: transcriptSource,
      created_at: new Date().toISOString(),
    },
    clinical_intake: clinical,
    confidence,
    provenance: {
      original_text: inputMode === 'TEXT' ? 'PATIENT_TYPED' : 'PATIENT_SPOKEN_TRANSCRIPT',
      detected_language: detectedLanguage ? 'AI_DETECTED' : detection.source,
      structured_fields: structuredSource,
      field_provenance: buildFieldProvenance(clinical, structuredSource),
    },
    patient_confirmed: false,
    patient_confirmed_at: null,
    extraction_status: extractionStatus,
    pipeline_version: PIPELINE_VERSION,
  };
}

function clampConfidence(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? numberOrZero(number) : fallback;
}

function parseJsonResponseText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    return null;
  }
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('') : '';
}

function isClinicalIntakeObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(EMPTY_CLINICAL_INTAKE).every(([key, empty]) => value[key] === undefined
      || (Array.isArray(empty) ? Array.isArray(value[key]) && value[key].every((item) => typeof item === 'string') : typeof value[key] === 'string')));
}

function sanitizeProviderClinical(value) {
  const clinical = sanitizeClinicalIntake(value);
  // The model is allowed to return broad category labels only. Unknown labels
  // are discarded rather than being shown as an implied diagnosis.
  clinical.possible_symptom_categories = clinical.possible_symptom_categories.filter((item) => ALLOWED_CATEGORIES.has(item));
  return clinical;
}

async function tryGeminiClinicalExtraction(text, selectedLanguage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const prompt = `You are a conservative multilingual clinical intake extractor. The selected language is ${selectedLanguage}. The patient statement may be Gujarati, Hindi, Marathi, English, or code-mixed. Translate only explicitly stated meaning into English normalized fields. Never diagnose, infer, summarize, add severity, or fill missing values. Keep denied symptoms in negative_symptoms. Use only broad categories: GENERAL_SYSTEMIC, RESPIRATORY, GASTROINTESTINAL, NEUROLOGICAL, MUSCULOSKELETAL, DERMATOLOGICAL, CARDIOVASCULAR. urgency is empty unless explicit emergency/severity language is present. Return JSON only with clinical_intake (chief_complaint string, duration string, symptoms string[], negative_symptoms string[], possible_symptom_categories string[], relevant_history string[], medications string[], allergies string[], allergy_status UNKNOWN/NONE_REPORTED/REPORTED, urgency LOW/MODERATE/HIGH/EMERGENCY or empty) and confidence (transcription, language, chief_complaint, symptoms, duration, category, allergies, urgency, overall numbers 0..1). Patient statement:\n${text}`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const parsed = parseJsonResponseText(extractGeminiText(payload));
    if (!parsed || !isClinicalIntakeObject(parsed.clinical_intake)) return null;
    return {
      clinical: sanitizeProviderClinical(parsed.clinical_intake),
      confidence: Object.fromEntries(Object.entries(parsed.confidence || {}).map(([key, value]) => [key, clampConfidence(value)])),
    };
  } catch {
    // Provider outages must not create fake facts or expose patient text in
    // logs. The caller uses the explicit deterministic fallback instead.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function processClinicalIntake(options) {
  const fallback = buildClinicalIntake(options);
  const providerResult = await tryGeminiClinicalExtraction(options.text, fallback.selected_language);
  if (!providerResult) return fallback;

  const structured = fallback;
  structured.clinical_intake = providerResult.clinical;
  structured.confidence = buildConfidence(providerResult.clinical, fallback.confidence.transcription, fallback.confidence.language);
  for (const key of Object.keys(structured.confidence)) {
    if (!['transcription', 'language'].includes(key) && Object.hasOwn(providerResult.confidence, key)) {
      structured.confidence[key] = providerResult.confidence[key];
    }
  }
  structured.provenance.structured_fields = 'AI_EXTRACTED';
  structured.provenance.field_provenance = buildFieldProvenance(providerResult.clinical, 'AI_EXTRACTED');
  structured.extraction_status = hasClinicalInformation(providerResult.clinical)
    ? 'READY'
    : 'REVIEW_REQUIRED';
  return structured;
}

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeStringArray(value, maxItems = 50) {
  if (!Array.isArray(value)) return [];
  return cleanList(value.slice(0, maxItems).map((item) => normalizeString(item, 160)));
}

function sanitizeClinicalIntake(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const allergyStatus = ALLERGY_STATUS_VALUES.has(input.allergy_status) ? input.allergy_status : 'UNKNOWN';
  const urgency = URGENCY_VALUES.has(input.urgency) ? input.urgency : '';
  const allergies = normalizeStringArray(input.allergies);
  return {
    chief_complaint: normalizeString(input.chief_complaint, 240),
    duration: normalizeString(input.duration, 120),
    symptoms: normalizeStringArray(input.symptoms),
    negative_symptoms: normalizeStringArray(input.negative_symptoms),
    possible_symptom_categories: normalizeStringArray(input.possible_symptom_categories, 10)
      .filter((item) => ALLOWED_CATEGORIES.has(item)),
    relevant_history: normalizeStringArray(input.relevant_history),
    medications: normalizeStringArray(input.medications),
    allergies,
    allergy_status: allergyStatus,
    urgency,
  };
}

module.exports = {
  PIPELINE_VERSION,
  EMPTY_CLINICAL_INTAKE,
  buildClinicalIntake,
  processClinicalIntake,
  sanitizeClinicalIntake,
  isClinicalIntakeObject,
  URGENCY_VALUES,
  ALLERGY_STATUS_VALUES,
};
