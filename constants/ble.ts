/**
 * Entrevoz BLE Constants
 *
 * Bluetooth Low Energy configuration for proximity discovery.
 *
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE & CHARACTERISTIC UUIDs
// ═══════════════════════════════════════════════════════════════════════════════

// Voxxo custom service UUID (registered with Bluetooth SIG format)
export const VOXXO_SERVICE_UUID = "0000FFFF-0000-1000-8000-00805F9B34FB";

// Characteristic UUIDs for Voxxo data
export const CHARACTERISTIC_UUIDS = {
  // User identification (16-byte session ID)
  USER_ID: "0000FF01-0000-1000-8000-00805F9B34FB",

  // Language code (2-byte ISO 639-1)
  LANGUAGE: "0000FF02-0000-1000-8000-00805F9B34FB",

  // User status (1-byte enum)
  STATUS: "0000FF03-0000-1000-8000-00805F9B34FB",

  // Connection request (write-only, used to initiate connection)
  CONNECTION_REQUEST: "0000FF04-0000-1000-8000-00805F9B34FB",

  // Room code for P2P connection (6-byte alphanumeric)
  ROOM_CODE: "0000FF05-0000-1000-8000-00805F9B34FB",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// USER STATUS ENUM
// ═══════════════════════════════════════════════════════════════════════════════

export const USER_STATUS = {
  AVAILABLE: 0x01,
  BUSY: 0x02,
  IN_CALL: 0x03,
  DO_NOT_DISTURB: 0x04,
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [USER_STATUS.AVAILABLE]: "Available",
  [USER_STATUS.BUSY]: "Busy",
  [USER_STATUS.IN_CALL]: "In Call",
  [USER_STATUS.DO_NOT_DISTURB]: "Do Not Disturb",
};

// ═══════════════════════════════════════════════════════════════════════════════
// BLE SCAN OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const BLE_SCAN_OPTIONS = {
  // How long to scan in each cycle (ms)
  SCAN_DURATION_MS: 10000,

  // How often to restart scanning (ms) - for battery efficiency
  SCAN_INTERVAL_MS: 15000,

  // Allow duplicate device reports (needed for RSSI updates)
  ALLOW_DUPLICATES: true,

  // Scan mode (Android)
  SCAN_MODE_LOW_LATENCY: 2,
  SCAN_MODE_BALANCED: 1,
  SCAN_MODE_LOW_POWER: 0,

  // Match mode (Android)
  MATCH_MODE_AGGRESSIVE: 1,
  MATCH_MODE_STICKY: 2,

  // Callback type
  CALLBACK_TYPE_ALL_MATCHES: 1,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// DISTANCE ESTIMATION CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DISTANCE_CONFIG = {
  // Calibrated TX power at 1 meter (device-specific, -59 is common default)
  TX_POWER_1M: -59,

  // Path loss exponent (2.0 = free space, 2.7-4.3 = indoor with obstacles)
  PATH_LOSS_EXPONENT: 2.5,

  // RSSI smoothing factor (0-1, higher = more responsive, lower = more stable)
  RSSI_SMOOTHING_FACTOR: 0.3,

  // Distance thresholds in meters
  IMMEDIATE_THRESHOLD: 3, // < 3m = immediate
  NEAR_THRESHOLD: 10, // 3-10m = near
  FAR_THRESHOLD: 30, // 10-30m = far

  // Maximum trackable distance (beyond this, signal unreliable)
  MAX_DISTANCE: 100,

  // Stale user timeout (ms) - remove if not seen for this long
  STALE_TIMEOUT_MS: 30000,
} as const;

export type DistanceCategory = "immediate" | "near" | "far" | "unknown";

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORTED LANGUAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸", nativeName: "English" },
  { code: "es", name: "Spanish", flag: "🇪🇸", nativeName: "Español" },
  { code: "fr", name: "French", flag: "🇫🇷", nativeName: "Français" },
  { code: "de", name: "German", flag: "🇩🇪", nativeName: "Deutsch" },
  { code: "it", name: "Italian", flag: "🇮🇹", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷", nativeName: "Português" },
  { code: "zh", name: "Chinese", flag: "🇨🇳", nativeName: "中文" },
  { code: "ja", name: "Japanese", flag: "🇯🇵", nativeName: "日本語" },
  { code: "ko", name: "Korean", flag: "🇰🇷", nativeName: "한국어" },
  { code: "ar", name: "Arabic", flag: "🇸🇦", nativeName: "العربية" },
  { code: "ru", name: "Russian", flag: "🇷🇺", nativeName: "Русский" },
  { code: "hi", name: "Hindi", flag: "🇮🇳", nativeName: "हिन्दी" },
  { code: "nl", name: "Dutch", flag: "🇳🇱", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", flag: "🇵🇱", nativeName: "Polski" },
  { code: "tr", name: "Turkish", flag: "🇹🇷", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳", nativeName: "Tiếng Việt" },
  { code: "th", name: "Thai", flag: "🇹🇭", nativeName: "ไทย" },
  {
    code: "id",
    name: "Indonesian",
    flag: "🇮🇩",
    nativeName: "Bahasa Indonesia",
  },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦", nativeName: "Українська" },
  { code: "el", name: "Greek", flag: "🇬🇷", nativeName: "Ελληνικά" },
  { code: "he", name: "Hebrew", flag: "🇮🇱", nativeName: "עברית" },
  { code: "sv", name: "Swedish", flag: "🇸🇪", nativeName: "Svenska" },
  { code: "cs", name: "Czech", flag: "🇨🇿", nativeName: "Čeština" },
  { code: "ro", name: "Romanian", flag: "🇷🇴", nativeName: "Română" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺", nativeName: "Magyar" },
  { code: "fi", name: "Finnish", flag: "🇫🇮", nativeName: "Suomi" },
  { code: "da", name: "Danish", flag: "🇩🇰", nativeName: "Dansk" },
  { code: "no", name: "Norwegian", flag: "🇳🇴", nativeName: "Norsk" },
  { code: "ms", name: "Malay", flag: "🇲🇾", nativeName: "Bahasa Melayu" },
  { code: "tl", name: "Filipino", flag: "🇵🇭", nativeName: "Tagalog" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function getLanguageByCode(code: string) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION REQUEST CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const CONNECTION_CONFIG = {
  // How long a connection request is valid (ms)
  REQUEST_TIMEOUT_MS: 60000,

  // How long to wait for response before auto-canceling (ms)
  RESPONSE_TIMEOUT_MS: 30000,

  // Room code length
  ROOM_CODE_LENGTH: 6,

  // Room code characters
  ROOM_CODE_CHARS: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
} as const;

// Generate random room code
export function generateRoomCode(): string {
  const chars = CONNECTION_CONFIG.ROOM_CODE_CHARS;
  let code = "";
  for (let i = 0; i < CONNECTION_CONFIG.ROOM_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

export const BLE_ERROR_CODES = {
  // State errors
  E001: {
    code: "E001",
    message: "Bluetooth is powered off",
    recoverable: true,
  },
  E002: {
    code: "E002",
    message: "Bluetooth permission denied",
    recoverable: true,
  },
  E003: {
    code: "E003",
    message: "Bluetooth not supported",
    recoverable: false,
  },

  // Scan errors
  E010: { code: "E010", message: "Scan failed to start", recoverable: true },
  E011: { code: "E011", message: "Scan timeout", recoverable: true },

  // Advertising errors
  E020: {
    code: "E020",
    message: "Advertising not supported",
    recoverable: false,
  },
  E021: {
    code: "E021",
    message: "Advertising failed to start",
    recoverable: true,
  },

  // Connection errors
  E030: {
    code: "E030",
    message: "Connection request timed out",
    recoverable: true,
  },
  E031: { code: "E031", message: "Connection rejected", recoverable: true },
  E032: {
    code: "E032",
    message: "Failed to establish connection",
    recoverable: true,
  },
} as const;

export type BLEErrorCode = keyof typeof BLE_ERROR_CODES;
