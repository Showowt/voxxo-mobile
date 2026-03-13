/**
 * Entrevoz Mobile Types
 *
 * Core TypeScript type definitions.
 *
 * @version 1.0.0
 */

import type {
  LanguageCode,
  UserStatus,
  DistanceCategory,
} from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// NEARBY USER
// ═══════════════════════════════════════════════════════════════════════════════

export interface NearbyUser {
  // Unique session identifier
  id: string;

  // BLE device identifier
  deviceId: string;

  // User's language
  language: LanguageCode;

  // Availability status
  status: UserStatus;

  // Estimated distance in meters
  distance: number;

  // Distance category
  distanceCategory: DistanceCategory;

  // Raw RSSI value
  rssi: number;

  // Smoothed RSSI (for stability)
  smoothedRssi: number;

  // Timestamp of last detection
  lastSeen: number;

  // Timestamp of first detection
  firstSeen: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConnectionRequest {
  // Request ID
  id: string;

  // Sender's session ID
  fromSessionId: string;

  // Sender's language
  fromLanguage: LanguageCode;

  // Room code for WebRTC connection
  roomCode: string;

  // When request was created
  createdAt: number;

  // When request expires
  expiresAt: number;

  // Request status
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY PRESENCE
// ═══════════════════════════════════════════════════════════════════════════════

export interface MyPresence {
  // My session ID
  sessionId: string;

  // My language
  language: LanguageCode;

  // My status
  status: UserStatus;

  // Whether I'm currently scanning
  isScanning: boolean;

  // Whether I'm currently advertising
  isAdvertising: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConversationMessage {
  id: string;
  speaker: "me" | "partner";
  originalText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  timestamp: number;
  isInterim?: boolean;
}

export interface ConversationState {
  // Room code for this conversation
  roomCode: string;

  // Partner info
  partnerId: string;
  partnerLanguage: LanguageCode;

  // Connection status
  connectionStatus:
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected";

  // Speech status
  isListening: boolean;
  isSpeaking: boolean;

  // Messages
  messages: ConversationMessage[];

  // Live captions
  myLiveText: string;
  myLiveTranslation: string;
  partnerLiveText: string;
  partnerLiveTranslation: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserSettings {
  // Selected language
  language: LanguageCode;

  // Auto-speak translations
  autoSpeak: boolean;

  // Speech rate (0.5 - 2.0)
  speechRate: number;

  // Haptic feedback
  hapticFeedback: boolean;

  // Dark mode (system | light | dark)
  theme: "system" | "light" | "dark";

  // Show distance in meters or feet
  distanceUnit: "meters" | "feet";

  // BLE scan mode
  scanMode: "low_power" | "balanced" | "low_latency";

  // Onboarding completed
  onboardingComplete: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROXIMITY STORE STATE
// ═══════════════════════════════════════════════════════════════════════════════

export type BLEState =
  | "unknown"
  | "resetting"
  | "unsupported"
  | "unauthorized"
  | "poweredOff"
  | "poweredOn"
  | "scanning"
  | "advertising";

export type ConnectionState =
  | "idle"
  | "requesting"
  | "waiting"
  | "incoming"
  | "connecting"
  | "connected"
  | "failed";

export interface ProximityState {
  // My presence
  myPresence: MyPresence;

  // Nearby users (keyed by ID)
  nearbyUsers: Record<string, NearbyUser>;

  // Currently selected user
  selectedUser: NearbyUser | null;

  // BLE state
  bleState: BLEState;
  bleError: string | null;

  // Connection state
  connectionState: ConnectionState;
  incomingRequest: ConnectionRequest | null;
  outgoingRequest: ConnectionRequest | null;

  // Active conversation
  conversation: ConversationState | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION API
// ═══════════════════════════════════════════════════════════════════════════════

export type TranslationProvider =
  | "cache"
  | "mymemory"
  | "libretranslate"
  | "passthrough"
  | "none"
  | "error";

export interface TranslationResult {
  success: boolean;
  translatedText: string;
  originalText: string;
  sourceLang: string;
  targetLang: string;
  provider: TranslationProvider;
  cached: boolean;
  detectedLanguage?: string;
  error?: string;
  latencyMs?: number;
}

export interface TranslationRequest {
  text: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}
