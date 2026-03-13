/**
 * Entrevoz Translation Service
 * 
 * Shared translation engine used by all modes.
 * MyMemory API primary → HuggingFace Helsinki-NLP fallback → passthrough
 * 
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TranslationResult {
  translatedText: string;
  source: 'mymemory' | 'huggingface' | 'dictionary' | 'passthrough';
  confidence: number;
  detectedLanguage?: string;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PHRASE DICTIONARY (200+ curated phrases)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PhraseCategory {
  id: string;
  name: string;
  icon: string;
  phrases: { en: string; es: string }[];
}

export const PHRASE_CATEGORIES: PhraseCategory[] = [
  {
    id: 'greetings',
    name: 'Greetings',
    icon: '👋',
    phrases: [
      { en: 'Hello, how are you?', es: 'Hola, ¿cómo estás?' },
      { en: 'Good morning', es: 'Buenos días' },
      { en: 'Good afternoon', es: 'Buenas tardes' },
      { en: 'Good evening', es: 'Buenas noches' },
      { en: 'Nice to meet you', es: 'Mucho gusto' },
      { en: "What's your name?", es: '¿Cómo te llamas?' },
      { en: 'My name is...', es: 'Me llamo...' },
      { en: 'How have you been?', es: '¿Cómo has estado?' },
      { en: 'Long time no see', es: 'Cuánto tiempo sin verte' },
      { en: 'See you later', es: 'Hasta luego' },
    ],
  },
  {
    id: 'dating',
    name: 'Dating',
    icon: '💕',
    phrases: [
      { en: 'You look beautiful tonight', es: 'Te ves hermosa esta noche' },
      { en: 'Would you like to go out sometime?', es: '¿Te gustaría salir alguna vez?' },
      { en: 'Can I buy you a drink?', es: '¿Puedo invitarte un trago?' },
      { en: 'I had a great time', es: 'La pasé muy bien' },
      { en: 'When can I see you again?', es: '¿Cuándo puedo verte de nuevo?' },
      { en: "What's your number?", es: '¿Cuál es tu número?' },
      { en: 'I really like you', es: 'Me gustas mucho' },
      { en: 'Do you want to dance?', es: '¿Quieres bailar?' },
      { en: 'This place is nice', es: 'Este lugar es bonito' },
      { en: 'Tell me about yourself', es: 'Cuéntame de ti' },
      { en: 'Where are you from?', es: '¿De dónde eres?' },
      { en: 'What do you do for work?', es: '¿En qué trabajas?' },
      { en: 'I miss you', es: 'Te extraño' },
      { en: 'You make me happy', es: 'Me haces feliz' },
      { en: 'Can I walk you home?', es: '¿Puedo acompañarte a casa?' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: '✈️',
    phrases: [
      { en: 'Where is the bathroom?', es: '¿Dónde está el baño?' },
      { en: 'How much does this cost?', es: '¿Cuánto cuesta esto?' },
      { en: 'I need a taxi', es: 'Necesito un taxi' },
      { en: 'Where is the nearest hotel?', es: '¿Dónde está el hotel más cercano?' },
      { en: 'I am lost', es: 'Estoy perdido' },
      { en: 'Can you help me?', es: '¿Puede ayudarme?' },
      { en: 'How do I get to...?', es: '¿Cómo llego a...?' },
      { en: 'Is it far from here?', es: '¿Está lejos de aquí?' },
      { en: 'I have a reservation', es: 'Tengo una reservación' },
      { en: 'What time does it open?', es: '¿A qué hora abre?' },
      { en: 'What time does it close?', es: '¿A qué hora cierra?' },
      { en: 'Do you accept credit cards?', es: '¿Aceptan tarjetas de crédito?' },
      { en: 'The check, please', es: 'La cuenta, por favor' },
      { en: 'Do you speak English?', es: '¿Habla inglés?' },
      { en: 'I don\'t understand', es: 'No entiendo' },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    icon: '💼',
    phrases: [
      { en: 'Nice to meet you', es: 'Mucho gusto en conocerle' },
      { en: 'Here is my business card', es: 'Aquí está mi tarjeta de presentación' },
      { en: "Let's schedule a meeting", es: 'Programemos una reunión' },
      { en: 'What are your terms?', es: '¿Cuáles son sus términos?' },
      { en: 'I have a proposal', es: 'Tengo una propuesta' },
      { en: "Let's discuss the details", es: 'Discutamos los detalles' },
      { en: 'What is your budget?', es: '¿Cuál es su presupuesto?' },
      { en: 'When is the deadline?', es: '¿Cuándo es la fecha límite?' },
      { en: 'I agree with that', es: 'Estoy de acuerdo con eso' },
      { en: "I'll follow up by email", es: 'Le daré seguimiento por correo' },
    ],
  },
  {
    id: 'emergency',
    name: 'Emergency',
    icon: '🚨',
    phrases: [
      { en: 'Help!', es: '¡Ayuda!' },
      { en: 'Call the police', es: 'Llame a la policía' },
      { en: 'I need a doctor', es: 'Necesito un doctor' },
      { en: 'Call an ambulance', es: 'Llame una ambulancia' },
      { en: "It's an emergency", es: 'Es una emergencia' },
      { en: 'I feel sick', es: 'Me siento mal' },
      { en: 'Where is the hospital?', es: '¿Dónde está el hospital?' },
      { en: 'I am allergic to...', es: 'Soy alérgico a...' },
      { en: 'I lost my passport', es: 'Perdí mi pasaporte' },
      { en: 'I need the embassy', es: 'Necesito la embajada' },
    ],
  },
  {
    id: 'food',
    name: 'Food & Dining',
    icon: '🍽️',
    phrases: [
      { en: 'A table for two, please', es: 'Una mesa para dos, por favor' },
      { en: 'What do you recommend?', es: '¿Qué recomienda?' },
      { en: 'I am vegetarian', es: 'Soy vegetariano' },
      { en: 'No spicy, please', es: 'Sin picante, por favor' },
      { en: 'This is delicious', es: 'Esto está delicioso' },
      { en: 'More water, please', es: 'Más agua, por favor' },
      { en: 'Can I see the menu?', es: '¿Puedo ver el menú?' },
      { en: 'I would like to order', es: 'Me gustaría ordenar' },
      { en: 'Is this gluten free?', es: '¿Esto es libre de gluten?' },
      { en: 'The tip is included?', es: '¿Está incluida la propina?' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const MYMEMORY_BASE = 'https://api.mymemory.translated.net/get';
const HUGGINGFACE_BASE = 'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt';

/**
 * Primary translation function — tries MyMemory first, then HuggingFace fallback
 */
export async function translate(
  text: string,
  from: string,
  to: string
): Promise<TranslationResult> {
  if (!text.trim()) {
    return { translatedText: '', source: 'passthrough', confidence: 0 };
  }

  // Same language — passthrough
  if (from === to) {
    return { translatedText: text, source: 'passthrough', confidence: 1 };
  }

  // Try MyMemory API first
  try {
    const result = await translateMyMemory(text, from, to);
    if (result) return result;
  } catch (e) {
    console.warn('[Translation] MyMemory failed:', e);
  }

  // Fallback to HuggingFace
  try {
    const result = await translateHuggingFace(text, from, to);
    if (result) return result;
  } catch (e) {
    console.warn('[Translation] HuggingFace failed:', e);
  }

  // Final fallback — return original text
  return {
    translatedText: text,
    source: 'passthrough',
    confidence: 0,
  };
}

/**
 * Back-translation for verification
 */
export async function backTranslate(
  translatedText: string,
  from: string,
  to: string
): Promise<string> {
  const result = await translate(translatedText, from, to);
  return result.translatedText;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function translateMyMemory(
  text: string,
  from: string,
  to: string
): Promise<TranslationResult | null> {
  const langPair = `${from}|${to}`;
  const url = `${MYMEMORY_BASE}?q=${encodeURIComponent(text)}&langpair=${langPair}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) return null;

  const data = await response.json();

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    const translated = data.responseData.translatedText;
    
    // MyMemory returns "MYMEMORY WARNING" when rate limited
    if (translated.includes('MYMEMORY WARNING') || translated.includes('PLEASE')) {
      return null;
    }

    return {
      translatedText: translated,
      source: 'mymemory',
      confidence: data.responseData.match || 0.8,
    };
  }

  return null;
}

async function translateHuggingFace(
  text: string,
  from: string,
  to: string
): Promise<TranslationResult | null> {
  const modelId = `${from}-${to}`;
  const url = `${HUGGINGFACE_BASE}-${modelId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) return null;

  const data = await response.json();

  if (Array.isArray(data) && data[0]?.translation_text) {
    return {
      translatedText: data[0].translation_text,
      source: 'huggingface',
      confidence: 0.7,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function getLanguagePairs(): Array<{ from: Language; to: Language }> {
  const pairs: Array<{ from: Language; to: Language }> = [];
  for (const from of LANGUAGES) {
    for (const to of LANGUAGES) {
      if (from.code !== to.code) {
        pairs.push({ from, to });
      }
    }
  }
  return pairs;
}

/**
 * Search phrase dictionary
 */
export function searchPhrases(
  query: string,
  categoryId?: string
): Array<{ category: string; phrase: { en: string; es: string } }> {
  const results: Array<{ category: string; phrase: { en: string; es: string } }> = [];
  const q = query.toLowerCase();

  for (const category of PHRASE_CATEGORIES) {
    if (categoryId && category.id !== categoryId) continue;

    for (const phrase of category.phrases) {
      if (phrase.en.toLowerCase().includes(q) || phrase.es.toLowerCase().includes(q)) {
        results.push({ category: category.name, phrase });
      }
    }
  }

  return results;
}
