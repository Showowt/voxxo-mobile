/**
 * Entrevoz Translation Service
 *
 * High-level translation service that wraps the core translation library.
 * Provides a clean API for screen components to use.
 *
 * @version 1.0.0
 */

import {
  translate as coreTranslate,
  translateBatch as coreTranslateBatch,
  detectLanguage as coreDetectLanguage,
  clearTranslationCache,
  getTranslationCacheSize,
} from "../lib/translation";
import type { LanguageCode } from "../constants/ble";
import type { TranslationResult, TranslationRequest } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TranslationOptions {
  /** Skip cache lookup */
  skipCache?: boolean;
  /** Enable auto-detection of source language */
  autoDetect?: boolean;
}

export interface TranslationServiceResult extends TranslationResult {
  /** Time taken in milliseconds */
  latencyMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class TranslationService {
  private defaultSourceLang: LanguageCode = "en";
  private defaultTargetLang: LanguageCode = "es";

  /**
   * Set default source language
   */
  setDefaultSourceLang(lang: LanguageCode): void {
    this.defaultSourceLang = lang;
  }

  /**
   * Set default target language
   */
  setDefaultTargetLang(lang: LanguageCode): void {
    this.defaultTargetLang = lang;
  }

  /**
   * Get current default languages
   */
  getDefaults(): { sourceLang: LanguageCode; targetLang: LanguageCode } {
    return {
      sourceLang: this.defaultSourceLang,
      targetLang: this.defaultTargetLang,
    };
  }

  /**
   * Translate text from source to target language
   */
  async translate(
    text: string,
    sourceLang?: LanguageCode,
    targetLang?: LanguageCode,
    options?: TranslationOptions
  ): Promise<TranslationServiceResult> {
    const startTime = Date.now();

    const source = sourceLang || this.defaultSourceLang;
    let target = targetLang || this.defaultTargetLang;

    // Auto-detect source language if enabled
    if (options?.autoDetect) {
      const detected = await this.detectLanguage(text);
      if (detected) {
        // If detected language matches target, swap to English
        if (detected === target) {
          target = detected === "en" ? "es" : "en";
        }
      }
    }

    const result = await coreTranslate(text, source, target);

    return {
      ...result,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    requests: TranslationRequest[]
  ): Promise<TranslationServiceResult[]> {
    const startTime = Date.now();
    const results = await coreTranslateBatch(requests);
    const latency = Date.now() - startTime;

    return results.map((r) => ({
      ...r,
      latencyMs: latency,
    }));
  }

  /**
   * Detect the language of given text
   */
  async detectLanguage(text: string): Promise<LanguageCode | null> {
    return coreDetectLanguage(text);
  }

  /**
   * Clear the translation cache
   */
  clearCache(): void {
    clearTranslationCache();
  }

  /**
   * Get current cache size
   */
  getCacheSize(): number {
    return getTranslationCacheSize();
  }

  /**
   * Quick translate with auto-swap if same language
   * Useful for face-to-face conversations where both might speak same language
   */
  async smartTranslate(
    text: string,
    myLang: LanguageCode,
    partnerLang: LanguageCode
  ): Promise<TranslationServiceResult> {
    // If same language, return passthrough
    if (myLang === partnerLang) {
      return {
        success: true,
        translatedText: text,
        originalText: text,
        sourceLang: myLang,
        targetLang: partnerLang,
        provider: "passthrough",
        cached: false,
        latencyMs: 0,
      };
    }

    return this.translate(text, myLang, partnerLang);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const translationService = new TranslationService();

// Also export convenience functions
export const translate = translationService.translate.bind(translationService);
export const translateBatch =
  translationService.translateBatch.bind(translationService);
export const detectLanguage =
  translationService.detectLanguage.bind(translationService);
export const smartTranslate =
  translationService.smartTranslate.bind(translationService);

export default translationService;
