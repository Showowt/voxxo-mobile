/**
 * Entrevoz Translation Service
 *
 * Multi-provider translation with fallback cascade.
 *
 * @version 1.0.0
 */

import type { LanguageCode } from "../constants/ble";
import type { TranslationResult, TranslationRequest } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TRANSLATION_API_URL = "https://voxlink-v14.vercel.app/api/translate";

// Simple in-memory cache
const translationCache = new Map<string, TranslationResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TRANSLATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function translate(
  text: string,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
): Promise<TranslationResult> {
  // Early return for empty text
  if (!text.trim()) {
    return {
      success: true,
      translatedText: "",
      originalText: "",
      sourceLang,
      targetLang,
      provider: "none",
      cached: false,
    };
  }

  // Same language = no translation needed
  if (sourceLang === targetLang) {
    return {
      success: true,
      translatedText: text,
      originalText: text,
      sourceLang,
      targetLang,
      provider: "passthrough",
      cached: false,
    };
  }

  // Check cache
  const cacheKey = `${sourceLang}:${targetLang}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  try {
    // Call Voxxo translation API
    const response = await fetch(TRANSLATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        sourceLang,
        targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Translation failed");
    }

    const result: TranslationResult = {
      success: true,
      translatedText: data.translatedText,
      originalText: text,
      sourceLang,
      targetLang,
      detectedLanguage: data.detectedLanguage,
      provider: data.provider || "voxxo",
      cached: false,
    };

    // Cache the result
    translationCache.set(cacheKey, result);

    // Clean up old cache entries
    setTimeout(() => {
      translationCache.delete(cacheKey);
    }, CACHE_TTL);

    return result;
  } catch (error) {
    console.error("Translation error:", error);

    // Return original text on error
    return {
      success: false,
      translatedText: text,
      originalText: text,
      sourceLang,
      targetLang,
      provider: "error",
      cached: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH TRANSLATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function translateBatch(
  requests: TranslationRequest[],
): Promise<TranslationResult[]> {
  return Promise.all(
    requests.map((req) => translate(req.text, req.sourceLang, req.targetLang)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function detectLanguage(
  text: string,
): Promise<LanguageCode | null> {
  try {
    const response = await fetch(TRANSLATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        sourceLang: "auto",
        targetLang: "en",
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return (data.detectedLanguage as LanguageCode) || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export function clearTranslationCache(): void {
  translationCache.clear();
}

export function getTranslationCacheSize(): number {
  return translationCache.size;
}
