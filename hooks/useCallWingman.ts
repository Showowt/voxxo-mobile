/**
 * useCallWingman.ts
 *
 * The master orchestration hook for Call Wingman.
 *
 * Data flow:
 * Phone call starts
 *   -> Native module detects call (CallKit / TelephonyManager)
 *   -> User taps "Activate Wingman"
 *   -> AVAudioEngine / SpeechRecognizer captures mic
 *   -> Every 1.5s silence -> transcript emitted
 *   -> Transcript sent to /api/cyrano (Claude)
 *   -> 3 suggestions returned (bold / warm / safe)
 *   -> "Warm" suggestion auto-spoken via AirPods TTS
 *   -> User sees all 3 options on screen
 *
 * @version 2.0.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as Speech from "expo-speech";
import CallAudio, {
  CallState,
  addCallStateListener,
  addTranscriptionListener,
  addErrorListener,
} from "../modules/voxlink-call-audio/src";

// ── Types ─────────────────────────────────────────────────────────────────────
export type WingmanMode = "date" | "interview" | "sales" | "hardtalk";
export type OutputMode = "ear" | "screen" | "both";

export interface WingmanSuggestion {
  bold: string;
  warm: string;
  safe: string;
}

export interface TranscriptLine {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface CallWingmanState {
  // Call state
  isCallActive: boolean;
  isCapturing: boolean;
  isLoading: boolean;
  callDurationSec: number;

  // Transcript
  liveTranscript: string;
  transcriptLog: TranscriptLine[];

  // AI
  suggestion: WingmanSuggestion | null;
  lastSpoken: string;

  // Settings
  mode: WingmanMode;
  outputMode: OutputMode;
  autoSpeak: boolean;
  language: string;

  // Error
  error: string | null;

  // Actions
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  setMode: (mode: WingmanMode) => void;
  setOutputMode: (mode: OutputMode) => void;
  setAutoSpeak: (val: boolean) => void;
  setLanguage: (lang: string) => void;
  clearTranscript: () => void;
}

// ── Mode Prompts ──────────────────────────────────────────────────────────────
const MODE_PROMPTS: Record<WingmanMode, string> = {
  date: `You are a real-time dating coach whispering in someone's ear during a phone call.
Generate 3 response suggestions based on what the other person just said.
BOLD: Confident, flirty, creates tension.
WARM: Genuine, emotionally present, connection-focused.
SAFE: Engaging but low-risk, friendly.
Rules: 1-2 sentences max. Sound completely natural. Reference what they said.`,

  interview: `You are a real-time interview coach whispering in someone's ear during a phone interview.
Generate 3 response suggestions for what the interviewer just said.
BOLD: Memorable, shows leadership and initiative.
WARM: Story-driven, authentic, relatable.
SAFE: Polished, professional, textbook strong answer.
Rules: 2-3 sentences max. Use STAR method when appropriate. Sound confident, not scripted.`,

  hardtalk: `You are a conflict resolution coach whispering during a difficult phone conversation.
Generate 3 responses to what the other person just said.
BOLD: Direct, honest, addresses the issue head-on without being aggressive.
WARM: Empathetic, validates their perspective while maintaining yours.
SAFE: Calm, de-escalating, seeks common ground.
Rules: Acknowledge before responding. Never passive-aggressive. Sound human.`,

  sales: `You are a sales coach whispering during a live sales call.
Generate 3 responses to what the prospect just said.
BOLD: Pattern interrupt, reframes objection as opportunity.
WARM: Leads with empathy, connects to value proposition naturally.
SAFE: Classic objection handling, professional and reliable.
Rules: Reference their exact words. Never manipulative. Short enough to remember.`,
};

// ── Cyrano API ────────────────────────────────────────────────────────────────
const CYRANO_URL = "https://voxlink-v14.vercel.app/api/cyrano";

async function fetchSuggestions(
  theirText: string,
  mode: WingmanMode,
  conversationHistory: string[],
): Promise<WingmanSuggestion | null> {
  const context = conversationHistory.slice(-6).join("\n");

  const userPrompt = `CONVERSATION CONTEXT:
${context || "(start of conversation)"}

THEY JUST SAID: "${theirText}"

Generate exactly 3 suggestions. Return ONLY valid JSON:
{"suggestions":[
  {"tone":"bold","text":"..."},
  {"tone":"warm","text":"..."},
  {"tone":"safe","text":"..."}
]}`;

  try {
    const res = await fetch(CYRANO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: MODE_PROMPTS[mode],
        userPrompt,
      }),
    });

    if (!res.ok) {
      console.error("[Cyrano] API error:", res.status);
      return null;
    }

    const data = await res.json();

    // Parse the content string as JSON
    const parsed = JSON.parse(data.content);

    // Transform array response to object format for UI
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      const bold =
        parsed.suggestions.find(
          (s: { tone: string; text: string }) => s.tone === "bold",
        )?.text ?? "";
      const warm =
        parsed.suggestions.find(
          (s: { tone: string; text: string }) => s.tone === "warm",
        )?.text ?? "";
      const safe =
        parsed.suggestions.find(
          (s: { tone: string; text: string }) => s.tone === "safe",
        )?.text ?? "";
      return { bold, warm, safe };
    }

    return null;
  } catch (e) {
    console.error("[Cyrano] Error:", e);
    return null;
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useCallWingman(): CallWingmanState {
  // ── State ──────────────────────────────────────────────────────────────────
  const [isCallActive, setIsCallActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [transcriptLog, setTranscriptLog] = useState<TranscriptLine[]>([]);
  const [suggestion, setSuggestion] = useState<WingmanSuggestion | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [mode, setMode] = useState<WingmanMode>("date");
  const [outputMode, setOutputMode] = useState<OutputMode>("both");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [language, setLanguage] = useState("en-US");
  const [error, setError] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const callTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationLog = useRef<string[]>([]);
  const processingRef = useRef(false);
  const modeRef = useRef(mode);
  const outputModeRef = useRef(outputMode);
  const autoSpeakRef = useRef(autoSpeak);

  // Keep refs in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    outputModeRef.current = outputMode;
  }, [outputMode]);
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  // ── Call timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isCapturing) {
      callTimer.current = setInterval(() => {
        setCallDurationSec((s) => s + 1);
      }, 1000);
    } else {
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }
      setCallDurationSec(0);
    }
    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, [isCapturing]);

  // ── Native event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    // Call state changes
    const callSub = addCallStateListener((event) => {
      const state = event.state;
      setIsCallActive(state.isActive);
      setIsCapturing(state.isCapturing);

      if (!state.isActive && isCapturing) {
        // Call ended while capturing
        setIsCapturing(false);
        setLiveTranscript("");
      }
    });

    // Transcription events
    const transcriptSub = addTranscriptionListener(async (event) => {
      const { text, isFinal } = event.result;

      if (!isFinal) {
        // Partial result - update live transcript
        setLiveTranscript(text);
        return;
      }

      // Final result - process with AI
      if (!text.trim() || processingRef.current || text.length < 4) return;

      // Add to log
      const line: TranscriptLine = {
        id: `t_${Date.now()}`,
        text,
        isFinal: true,
        timestamp: Date.now(),
      };
      setTranscriptLog((prev) => [...prev.slice(-20), line]);
      conversationLog.current.push(`Them: ${text}`);
      setLiveTranscript("");

      // Fetch AI suggestions
      processingRef.current = true;
      setIsLoading(true);

      try {
        const result = await fetchSuggestions(
          text,
          modeRef.current,
          conversationLog.current,
        );

        if (result) {
          setSuggestion(result);

          // Auto-speak warm suggestion if enabled
          if (
            autoSpeakRef.current &&
            (outputModeRef.current === "ear" ||
              outputModeRef.current === "both")
          ) {
            Speech.stop();
            Speech.speak(result.warm, {
              language: "en-US",
              rate: 0.9,
              pitch: 0.95,
            });
            setLastSpoken(result.warm);
            conversationLog.current.push(`Me (suggested): ${result.warm}`);
          }
        }
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    });

    // Error events
    const errorSub = addErrorListener((event) => {
      console.warn("[CallWingman] Error:", event.code, event.message);
      setError(event.message);
    });

    return () => {
      callSub.remove();
      transcriptSub.remove();
      errorSub.remove();
    };
  }, [isCapturing]);

  // ── Activate ───────────────────────────────────────────────────────────────
  const activate = useCallback(async () => {
    const supported = await CallAudio.isSupported();

    if (!supported) {
      Alert.alert(
        "Not Available",
        "Call Wingman requires a native build with microphone and speech recognition permissions.\n\nPlease build the app with EAS Build.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      await CallAudio.startCallWingman({
        enableSpeaker: true,
        enableNoiseCancellation: true,
        outputDevice: "airpods",
        captureMode: "ambient",
        language,
      });

      setIsCapturing(true);
      setError(null);
      conversationLog.current = [];
      setSuggestion(null);
    } catch (e) {
      const err = e as Error;
      Alert.alert(
        "Wingman Error",
        err.message ?? "Failed to start. Make sure call is on speaker.",
        [{ text: "OK" }],
      );
    }
  }, [language]);

  // ── Deactivate ─────────────────────────────────────────────────────────────
  const deactivate = useCallback(async () => {
    Speech.stop();
    await CallAudio.stopCallWingman();
    setIsCapturing(false);
    setLiveTranscript("");
  }, []);

  // ── Speak a specific suggestion ────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    if (outputModeRef.current === "screen") {
      // Screen only - don't speak, just track
      setLastSpoken(text);
      conversationLog.current.push(`Me: ${text}`);
      return;
    }

    Speech.stop();
    Speech.speak(text, {
      language: "en-US",
      rate: 0.9,
      pitch: 0.95,
    });
    setLastSpoken(text);
    conversationLog.current.push(`Me: ${text}`);
  }, []);

  // ── Stop speaking ──────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(async () => {
    Speech.stop();
  }, []);

  // ── Clear transcript ───────────────────────────────────────────────────────
  const clearTranscript = useCallback(() => {
    setTranscriptLog([]);
    conversationLog.current = [];
    setSuggestion(null);
    setLiveTranscript("");
  }, []);

  return {
    isCallActive,
    isCapturing,
    isLoading,
    callDurationSec,
    liveTranscript,
    transcriptLog,
    suggestion,
    lastSpoken,
    mode,
    outputMode,
    autoSpeak,
    language,
    error,
    activate,
    deactivate,
    speak,
    stopSpeaking,
    setMode,
    setOutputMode,
    setAutoSpeak,
    setLanguage,
    clearTranscript,
  };
}

// ── Format call duration ──────────────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
