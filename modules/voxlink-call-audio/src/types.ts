/**
 * VoxLink Call Audio Types
 * Native module for phone call audio integration
 */

export type CaptureMode = "ambient" | "accessibility" | "direct";
export type OutputDevice = "speaker" | "airpods" | "auto";
export type CallDirection = "incoming" | "outgoing" | "unknown";

export interface CallState {
  /** Whether a call is currently active */
  isActive: boolean;
  /** Call direction */
  direction: CallDirection;
  /** Phone number if available */
  phoneNumber?: string;
  /** Call duration in seconds */
  duration: number;
  /** Whether speaker is enabled */
  isSpeakerOn: boolean;
  /** Whether we're capturing audio */
  isCapturing: boolean;
}

export interface CallAudioConfig {
  /** Auto-enable speaker when wingman starts */
  enableSpeaker: boolean;
  /** Apply noise cancellation to captured audio */
  enableNoiseCancellation: boolean;
  /** Where to route TTS output */
  outputDevice: OutputDevice;
  /** How to capture the other person's voice */
  captureMode: CaptureMode;
  /** Language for speech recognition */
  language: string;
}

export interface TranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Whether this is a final result */
  isFinal: boolean;
  /** Confidence score 0-1 */
  confidence: number;
  /** Timestamp */
  timestamp: number;
}

export interface AudioLevel {
  /** Current audio level 0-1 */
  level: number;
  /** Whether voice activity is detected */
  isSpeaking: boolean;
}

export type CallStateChangeEvent = {
  state: CallState;
};

export type TranscriptionEvent = {
  result: TranscriptionResult;
};

export type AudioLevelEvent = {
  level: AudioLevel;
};

export type ErrorEvent = {
  code: string;
  message: string;
};
