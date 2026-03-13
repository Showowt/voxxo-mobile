/**
 * Entrevoz Speech Recognition Service
 *
 * Real implementation using expo-speech-recognition.
 * Falls back to mock mode on simulators or when unavailable.
 *
 * @version 2.0.0
 */

import { Platform } from "react-native";
import * as ExpoDevice from "expo-device";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { LanguageCode } from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SpeechRecognitionCallbacks {
  /** Called with interim (partial) results while speaking */
  onInterimResult: (text: string) => void;

  /** Called with final transcription after speech ends */
  onFinalResult: (text: string) => void;

  /** Called when speech recognition starts */
  onStart: () => void;

  /** Called when speech recognition ends */
  onEnd: () => void;

  /** Called on error */
  onError: (error: string) => void;

  /** Called when volume/audio level changes */
  onVolumeChange?: (volume: number) => void;
}

export interface SpeechRecognitionOptions {
  /** Language to recognize (ISO 639-1 code) */
  language: LanguageCode;

  /** Whether to return interim results */
  interimResults?: boolean;

  /** Maximum recording duration in ms */
  maxDuration?: number;

  /** Punctuation preference */
  addsPunctuation?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE LOCALE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const LANGUAGE_LOCALES: Record<LanguageCode, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-BR",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ru: "ru-RU",
  ar: "ar-SA",
  hi: "hi-IN",
  nl: "nl-NL",
  pl: "pl-PL",
  tr: "tr-TR",
  vi: "vi-VN",
  th: "th-TH",
  id: "id-ID",
  uk: "uk-UA",
  el: "el-GR",
  he: "he-IL",
  sv: "sv-SE",
  cs: "cs-CZ",
  ro: "ro-RO",
  hu: "hu-HU",
  fi: "fi-FI",
  da: "da-DK",
  no: "nb-NO",
  ms: "ms-MY",
  tl: "fil-PH",
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPEECH RECOGNITION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class SpeechRecognitionService {
  private isListening: boolean = false;
  private callbacks: SpeechRecognitionCallbacks;
  private currentLanguage: LanguageCode = "en";
  private useMockMode: boolean = false;
  private simulationTimer: ReturnType<typeof setTimeout> | null = null;

  // Sample phrases for mock simulation
  private readonly samplePhrases: Record<string, string[]> = {
    en: [
      "Hello, how are you?",
      "Nice to meet you",
      "What time is it?",
      "Thank you very much",
      "Where is the restaurant?",
    ],
    es: [
      "Hola, ¿cómo estás?",
      "Mucho gusto",
      "¿Qué hora es?",
      "Muchas gracias",
      "¿Dónde está el restaurante?",
    ],
    fr: [
      "Bonjour, comment allez-vous?",
      "Enchanté",
      "Quelle heure est-il?",
      "Merci beaucoup",
      "Où est le restaurant?",
    ],
  };

  constructor(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = callbacks;
    // Use mock mode on simulators or web
    this.useMockMode = !ExpoDevice.isDevice || Platform.OS === "web";

    if (this.useMockMode) {
      console.log(
        "[SpeechRecognition] Running in mock mode (simulator/web detected)",
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERMISSION CHECK
  // ─────────────────────────────────────────────────────────────────────────────

  async checkPermission(): Promise<boolean> {
    if (this.useMockMode) {
      return true;
    }

    try {
      const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return result.granted;
    } catch (error) {
      console.error("[SpeechRecognition] Permission check failed:", error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (this.useMockMode) {
      return true;
    }

    try {
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    } catch (error) {
      console.error("[SpeechRecognition] Permission request failed:", error);
      return false;
    }
  }

  async getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
    if (this.useMockMode) {
      return "granted";
    }

    try {
      const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (result.granted) return "granted";
      if (result.canAskAgain) return "undetermined";
      return "denied";
    } catch {
      return "undetermined";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECOGNITION CONTROL
  // ─────────────────────────────────────────────────────────────────────────────

  async start(options: SpeechRecognitionOptions): Promise<void> {
    if (this.isListening) {
      return;
    }

    this.currentLanguage = options.language;
    this.isListening = true;

    if (this.useMockMode) {
      this.callbacks.onStart();
      this.simulateSpeech(options);
      return;
    }

    try {
      // Request permission if needed
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        const granted = await this.requestPermission();
        if (!granted) {
          this.isListening = false;
          this.callbacks.onError("Microphone permission denied");
          return;
        }
      }

      // Get locale for the language
      const locale = LANGUAGE_LOCALES[options.language] || "en-US";

      // Start real speech recognition
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: options.interimResults ?? true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: options.addsPunctuation ?? true,
      });

      this.callbacks.onStart();
    } catch (error) {
      this.isListening = false;
      const message =
        error instanceof Error ? error.message : "Failed to start recognition";
      this.callbacks.onError(message);
      console.error("[SpeechRecognition] Start failed:", error);
    }
  }

  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    if (this.useMockMode) {
      if (this.simulationTimer) {
        clearTimeout(this.simulationTimer);
        this.simulationTimer = null;
      }
      this.isListening = false;
      this.callbacks.onEnd();
      return;
    }

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error("[SpeechRecognition] Stop failed:", error);
    }

    this.isListening = false;
    this.callbacks.onEnd();
  }

  async abort(): Promise<void> {
    if (this.useMockMode) {
      await this.stop();
      return;
    }

    try {
      ExpoSpeechRecognitionModule.abort();
    } catch (error) {
      console.error("[SpeechRecognition] Abort failed:", error);
    }

    this.isListening = false;
    this.callbacks.onEnd();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MOCK SIMULATION (for simulators/testing)
  // ─────────────────────────────────────────────────────────────────────────────

  private simulateSpeech(options: SpeechRecognitionOptions): void {
    const phrases =
      this.samplePhrases[this.currentLanguage] || this.samplePhrases.en;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const words = phrase.split(" ");

    let currentIndex = 0;

    const simulateWord = () => {
      if (!this.isListening || currentIndex >= words.length) {
        if (this.isListening) {
          this.callbacks.onFinalResult(phrase);
          this.isListening = false;
          this.callbacks.onEnd();
        }
        return;
      }

      currentIndex++;
      const interimText = words.slice(0, currentIndex).join(" ");

      if (options.interimResults) {
        this.callbacks.onInterimResult(interimText);
      }

      this.simulationTimer = setTimeout(
        simulateWord,
        300 + Math.random() * 200,
      );
    };

    this.simulationTimer = setTimeout(simulateWord, 500);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS (called from React hook)
  // ─────────────────────────────────────────────────────────────────────────────

  handleResult(results: string[], isFinal: boolean): void {
    const text = results[0] || "";
    if (isFinal) {
      this.callbacks.onFinalResult(text);
    } else {
      this.callbacks.onInterimResult(text);
    }
  }

  handleEnd(): void {
    this.isListening = false;
    this.callbacks.onEnd();
  }

  handleError(error: string): void {
    this.isListening = false;
    this.callbacks.onError(error);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────

  get listening(): boolean {
    return this.isListening;
  }

  get language(): LanguageCode {
    return this.currentLanguage;
  }

  get isMockMode(): boolean {
    return this.useMockMode;
  }

  updateCallbacks(callbacks: Partial<SpeechRecognitionCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REACT HOOK FOR EVENT BINDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to bind speech recognition events to the service.
 * Must be called in a React component to enable event handling.
 */
export function useSpeechRecognition(
  service: SpeechRecognitionService | null,
): void {
  // Handle recognition results
  useSpeechRecognitionEvent("result", (event) => {
    if (!service || service.isMockMode) return;

    const results = event.results;
    if (results && results.length > 0) {
      const firstResult = results[results.length - 1];
      const transcript =
        firstResult && "transcript" in firstResult
          ? (firstResult as { transcript: string }).transcript
          : "";
      const isFinal = event.isFinal ?? false;
      service.handleResult([transcript], isFinal);
    }
  });

  // Handle recognition end
  useSpeechRecognitionEvent("end", () => {
    if (!service || service.isMockMode) return;
    service.handleEnd();
  });

  // Handle recognition errors
  useSpeechRecognitionEvent("error", (event) => {
    if (!service || service.isMockMode) return;
    service.handleError(event.error || "Recognition error");
  });

  // Handle volume changes (optional)
  useSpeechRecognitionEvent("volumechange", (event) => {
    if (!service || service.isMockMode) return;
    // Volume is typically 0-1, convert if needed
    const volume = event.value ?? 0;
    service.updateCallbacks({
      onVolumeChange: service["callbacks"].onVolumeChange,
    });
    service["callbacks"].onVolumeChange?.(volume);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let speechServiceInstance: SpeechRecognitionService | null = null;

export function createSpeechRecognitionService(
  callbacks: SpeechRecognitionCallbacks,
): SpeechRecognitionService {
  if (speechServiceInstance) {
    speechServiceInstance.abort();
  }
  speechServiceInstance = new SpeechRecognitionService(callbacks);
  return speechServiceInstance;
}

export function getSpeechRecognitionService(): SpeechRecognitionService | null {
  return speechServiceInstance;
}

export function destroySpeechRecognitionService(): void {
  if (speechServiceInstance) {
    speechServiceInstance.abort();
    speechServiceInstance = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

export async function isSpeechRecognitionAvailable(): Promise<boolean> {
  // Always available (mock mode fallback)
  if (!ExpoDevice.isDevice || Platform.OS === "web") {
    return true; // Mock mode
  }

  try {
    const status = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    return status !== null;
  } catch {
    return true; // Fallback to mock
  }
}

export async function getSupportedLocales(): Promise<string[]> {
  if (!ExpoDevice.isDevice || Platform.OS === "web") {
    return Object.values(LANGUAGE_LOCALES);
  }

  try {
    const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: undefined,
    });
    return locales.locales || Object.values(LANGUAGE_LOCALES);
  } catch {
    return Object.values(LANGUAGE_LOCALES);
  }
}
