/**
 * Entrevoz Link Generator
 *
 * Generates shareable room codes and URLs for Face-to-Face translation.
 * Works on both web and mobile platforms.
 *
 * @version 2.0.0
 */

import { Platform, Share } from "react-native";
import * as Linking from "expo-linking";
import {
  CONNECTION_CONFIG,
  LANGUAGES,
  type LanguageCode,
} from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Base URL for web sharing
const WEB_BASE_URL = "https://entrevoz.co";

// Deep link scheme for native app
const APP_SCHEME = "entrevoz";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique 6-character room code.
 * Uses URL-safe characters that are easy to read and type.
 * Excludes confusing characters like O/0, I/1/l.
 */
export function generateRoomCode(): string {
  const chars = CONNECTION_CONFIG.ROOM_CODE_CHARS;
  let code = "";
  for (let i = 0; i < CONNECTION_CONFIG.ROOM_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate a room code format.
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== "string") {
    return false;
  }

  // Must be exactly 6 characters
  if (code.length !== CONNECTION_CONFIG.ROOM_CODE_LENGTH) {
    return false;
  }

  // Must only contain valid characters
  const validChars = new Set(CONNECTION_CONFIG.ROOM_CODE_CHARS.split(""));
  for (const char of code.toUpperCase()) {
    if (!validChars.has(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize a room code (uppercase, trim).
 */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the shareable web URL for a room code.
 * This URL can be opened in any browser and will:
 * - On mobile: Attempt to open the Entrevoz app, fallback to web
 * - On desktop: Open the web version
 */
export function getShareableUrl(
  roomCode: string,
  myLanguage?: LanguageCode,
): string {
  const normalizedCode = normalizeRoomCode(roomCode);

  // Add language param if provided
  const params = myLanguage ? `?lang=${myLanguage}` : "";

  return `${WEB_BASE_URL}/talk/${normalizedCode}${params}`;
}

/**
 * Get the deep link URL for the native app.
 */
export function getDeepLinkUrl(
  roomCode: string,
  myLanguage?: LanguageCode,
): string {
  const normalizedCode = normalizeRoomCode(roomCode);
  const params = myLanguage ? `?lang=${myLanguage}` : "";

  return `${APP_SCHEME}://talk/${normalizedCode}${params}`;
}

/**
 * Get the Expo development link (for testing in development).
 */
export function getExpoLinkUrl(
  roomCode: string,
  myLanguage?: LanguageCode,
): string {
  const normalizedCode = normalizeRoomCode(roomCode);
  const params = myLanguage ? `&lang=${myLanguage}` : "";

  // Uses Expo Linking to generate the correct URL based on environment
  return Linking.createURL(`talk/${normalizedCode}${params}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARING
// ═══════════════════════════════════════════════════════════════════════════════

interface ShareResult {
  success: boolean;
  error?: string;
  action?: string;
}

/**
 * Share a conversation link using the native share sheet.
 * Works on iOS, Android, and web.
 */
export async function shareConversationLink(
  roomCode: string,
  myLanguage: LanguageCode,
): Promise<ShareResult> {
  try {
    const url = getShareableUrl(roomCode, myLanguage);
    const langInfo = LANGUAGES.find((l) => l.code === myLanguage);
    const langName = langInfo?.name || "your language";

    const shareMessage = Platform.select({
      ios: `Join me for a real-time translated conversation! I speak ${langName}. ${url}`,
      android: `Join me for a real-time translated conversation! I speak ${langName}.`,
      web: `Join me for a real-time translated conversation! I speak ${langName}. ${url}`,
      default: `Join me for a real-time translated conversation! I speak ${langName}. ${url}`,
    });

    if (Platform.OS === "web") {
      // Web Share API
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Entrevoz - Real-time Translation",
          text: `Join me for a real-time translated conversation! I speak ${langName}.`,
          url: url,
        });
        return { success: true, action: "shared" };
      } else {
        // Fallback: copy to clipboard
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          return { success: true, action: "copied" };
        }
        // Ultimate fallback: open in new tab
        if (typeof window !== "undefined") {
          window.open(url, "_blank");
          return { success: true, action: "opened" };
        }
        return { success: false, error: "Sharing not supported" };
      }
    }

    // Native Share API
    const result = await Share.share(
      {
        message: shareMessage,
        url: Platform.OS === "ios" ? url : undefined, // iOS includes URL separately
        title: "Entrevoz - Real-time Translation",
      },
      {
        dialogTitle: "Share conversation link",
        subject: "Join my Entrevoz conversation",
      },
    );

    if (result.action === Share.sharedAction) {
      return { success: true, action: "shared" };
    } else if (result.action === Share.dismissedAction) {
      return { success: true, action: "dismissed" };
    }

    return { success: true, action: result.action };
  } catch (error) {
    console.error("[LinkGenerator] Share error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Copy a link to clipboard.
 */
export async function copyLinkToClipboard(
  roomCode: string,
  myLanguage?: LanguageCode,
): Promise<boolean> {
  try {
    const url = getShareableUrl(roomCode, myLanguage);

    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      return false;
    }

    // Native: use Clipboard API from react-native
    const { Clipboard } = require("react-native");
    if (Clipboard && Clipboard.setString) {
      Clipboard.setString(url);
      return true;
    }

    // Fallback: expo-clipboard if available
    try {
      const ExpoClipboard = require("expo-clipboard");
      await ExpoClipboard.setStringAsync(url);
      return true;
    } catch {
      // expo-clipboard not installed
    }

    return false;
  } catch (error) {
    console.error("[LinkGenerator] Copy error:", error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL PARSING
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedTalkUrl {
  roomCode: string;
  language?: LanguageCode;
}

/**
 * Parse a talk URL to extract room code and optional language.
 */
export function parseTalkUrl(url: string): ParsedTalkUrl | null {
  try {
    // Handle different URL formats
    // - https://entrevoz.co/talk/ABC123?lang=en
    // - entrevoz://talk/ABC123?lang=en
    // - /talk/ABC123?lang=en

    let path: string;
    let queryString: string = "";

    if (url.includes("://")) {
      const urlObj = new URL(url);
      path = urlObj.pathname;
      queryString = urlObj.search;
    } else {
      const [pathPart, query] = url.split("?");
      path = pathPart;
      queryString = query ? `?${query}` : "";
    }

    // Extract room code from path
    const talkMatch = path.match(/\/talk\/([A-Z0-9]+)/i);
    if (!talkMatch) {
      return null;
    }

    const roomCode = normalizeRoomCode(talkMatch[1]);
    if (!isValidRoomCode(roomCode)) {
      return null;
    }

    // Extract language from query string
    let language: LanguageCode | undefined;
    if (queryString) {
      const params = new URLSearchParams(queryString);
      const lang = params.get("lang");
      if (lang && LANGUAGES.some((l) => l.code === lang)) {
        language = lang as LanguageCode;
      }
    }

    return { roomCode, language };
  } catch (error) {
    console.error("[LinkGenerator] Parse error:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  getShareableUrl,
  getDeepLinkUrl,
  getExpoLinkUrl,
  shareConversationLink,
  copyLinkToClipboard,
  parseTalkUrl,
};
