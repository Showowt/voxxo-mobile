/**
 * Entrevoz Realtime Service
 *
 * Supabase Realtime channels for peer-to-peer conversation sync.
 * Uses room codes from BLE handshake to establish conversation channels.
 *
 * @version 1.0.0
 */

import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { LanguageCode } from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RealtimeMessage {
  type: "speech" | "translation" | "status" | "end";
  senderId: string;
  senderLanguage: LanguageCode;
  payload: SpeechPayload | StatusPayload | EndPayload;
  timestamp: number;
}

export interface SpeechPayload {
  originalText: string;
  translatedText: string;
  isInterim: boolean;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}

export interface StatusPayload {
  status: "listening" | "speaking" | "idle" | "reconnecting";
}

export interface EndPayload {
  reason: "user_ended" | "timeout" | "error";
}

export interface RealtimeCallbacks {
  onMessage: (message: RealtimeMessage) => void;
  onPresenceJoin: (userId: string, language: LanguageCode) => void;
  onPresenceLeave: (userId: string) => void;
  onError: (error: Error) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REALTIME SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private roomCode: string = "";
  private userId: string = "";
  private userLanguage: LanguageCode = "en";
  private callbacks: RealtimeCallbacks;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Join a conversation room using the room code from BLE handshake.
   */
  async joinRoom(
    roomCode: string,
    userId: string,
    language: LanguageCode,
  ): Promise<void> {
    // Leave existing room if any
    if (this.channel) {
      await this.leaveRoom();
    }

    this.roomCode = roomCode;
    this.userId = userId;
    this.userLanguage = language;
    this.reconnectAttempts = 0;

    // Create channel with room code
    this.channel = supabase.channel(`entrevoz:${roomCode}`, {
      config: {
        broadcast: {
          self: false, // Don't receive own messages
        },
        presence: {
          key: userId,
        },
      },
    });

    // Set up message handler
    this.channel.on("broadcast", { event: "message" }, ({ payload }) => {
      if (payload && this.isRealtimeMessage(payload)) {
        this.callbacks.onMessage(payload as RealtimeMessage);
      }
    });

    // Set up presence handlers
    this.channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      if (key && key !== this.userId) {
        const presence = newPresences?.[0];
        const language = (presence?.language as LanguageCode) || "en";
        this.callbacks.onPresenceJoin(key, language);
      }
    });

    this.channel.on("presence", { event: "leave" }, ({ key }) => {
      if (key && key !== this.userId) {
        this.callbacks.onPresenceLeave(key);
      }
    });

    // Subscribe to channel
    this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Track presence
        await this.channel?.track({
          id: this.userId,
          language: this.userLanguage,
          online_at: new Date().toISOString(),
        });

        this.callbacks.onConnected();
      } else if (status === "CHANNEL_ERROR") {
        this.isConnected = false;
        this.callbacks.onError(new Error("Channel error"));
        this.attemptReconnect();
      } else if (status === "TIMED_OUT") {
        this.isConnected = false;
        this.callbacks.onError(new Error("Connection timed out"));
        this.attemptReconnect();
      } else if (status === "CLOSED") {
        this.isConnected = false;
        this.callbacks.onDisconnected();
      }
    });
  }

  /**
   * Leave the current conversation room.
   */
  async leaveRoom(): Promise<void> {
    if (this.channel) {
      try {
        // Send end message before leaving
        await this.sendEndMessage("user_ended");

        // Untrack presence
        await this.channel.untrack();

        // Unsubscribe from channel
        await supabase.removeChannel(this.channel);
      } catch (error) {
        console.warn(
          "[RealtimeService] Error during leaveRoom cleanup:",
          error,
        );
      } finally {
        this.channel = null;
        this.isConnected = false;
        this.roomCode = "";
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGE SENDING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a speech message (original + translated text).
   */
  async sendSpeech(
    originalText: string,
    translatedText: string,
    targetLang: LanguageCode,
    isInterim: boolean = false,
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      return;
    }

    try {
      const message: RealtimeMessage = {
        type: "speech",
        senderId: this.userId,
        senderLanguage: this.userLanguage,
        payload: {
          originalText,
          translatedText,
          isInterim,
          sourceLang: this.userLanguage,
          targetLang,
        } as SpeechPayload,
        timestamp: Date.now(),
      };

      await this.channel.send({
        type: "broadcast",
        event: "message",
        payload: message,
      });
    } catch (error) {
      console.error("[RealtimeService] Failed to send speech:", error);
      this.callbacks.onError(new Error("Failed to send message"));
    }
  }

  /**
   * Send a status update (listening, speaking, idle).
   */
  async sendStatus(
    status: "listening" | "speaking" | "idle" | "reconnecting",
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      return;
    }

    try {
      const message: RealtimeMessage = {
        type: "status",
        senderId: this.userId,
        senderLanguage: this.userLanguage,
        payload: { status } as StatusPayload,
        timestamp: Date.now(),
      };

      await this.channel.send({
        type: "broadcast",
        event: "message",
        payload: message,
      });
    } catch (error) {
      console.error("[RealtimeService] Failed to send status:", error);
    }
  }

  /**
   * Send an end message.
   */
  async sendEndMessage(
    reason: "user_ended" | "timeout" | "error",
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      return;
    }

    try {
      const message: RealtimeMessage = {
        type: "end",
        senderId: this.userId,
        senderLanguage: this.userLanguage,
        payload: { reason } as EndPayload,
        timestamp: Date.now(),
      };

      await this.channel.send({
        type: "broadcast",
        event: "message",
        payload: message,
      });
    } catch (error) {
      console.error("[RealtimeService] Failed to send end message:", error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.callbacks.onError(new Error("Max reconnection attempts reached"));
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;

    setTimeout(async () => {
      if (this.roomCode && !this.isConnected) {
        try {
          await this.joinRoom(this.roomCode, this.userId, this.userLanguage);
        } catch (error) {
          this.attemptReconnect();
        }
      }
    }, delay);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  private isRealtimeMessage(payload: unknown): payload is RealtimeMessage {
    if (typeof payload !== "object" || payload === null) {
      return false;
    }

    const msg = payload as Record<string, unknown>;
    return (
      typeof msg.type === "string" &&
      typeof msg.senderId === "string" &&
      typeof msg.timestamp === "number" &&
      msg.payload !== undefined
    );
  }

  /**
   * Get connection status.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current room code.
   */
  get currentRoomCode(): string {
    return this.roomCode;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let realtimeInstance: RealtimeService | null = null;

export function createRealtimeService(
  callbacks: RealtimeCallbacks,
): RealtimeService {
  if (realtimeInstance) {
    realtimeInstance.leaveRoom();
  }
  realtimeInstance = new RealtimeService(callbacks);
  return realtimeInstance;
}

export function getRealtimeService(): RealtimeService | null {
  return realtimeInstance;
}

export function destroyRealtimeService(): void {
  if (realtimeInstance) {
    realtimeInstance.leaveRoom();
    realtimeInstance = null;
  }
}
