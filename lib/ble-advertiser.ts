/**
 * Entrevoz BLE Advertiser
 *
 * Mock implementation for build testing.
 *
 * @version 2.0.0 (Mock)
 */

import type { LanguageCode, UserStatus } from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AdvertiserState =
  | "idle"
  | "starting"
  | "advertising"
  | "stopping"
  | "error";

export interface AdvertiseData {
  sessionId: string;
  language: LanguageCode;
  status: UserStatus;
}

export interface ConnectionRequestPayload {
  fromSessionId: string;
  fromLanguage: LanguageCode;
  roomCode: string;
}

export interface AdvertiserError {
  code: string;
  message: string;
}

export interface AdvertiserCallbacks {
  onStateChange?: (state: AdvertiserState) => void;
  onConnectionRequest?: (payload: ConnectionRequestPayload) => void;
  onError?: (error: AdvertiserError) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK ADVERTISER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class BLEAdvertiser {
  private isAdvertising: boolean = false;
  private currentData: AdvertiseData | null = null;
  private callbacks: AdvertiserCallbacks = {};

  constructor(callbacks?: AdvertiserCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  async isSupported(): Promise<boolean> {
    return true; // Mock always returns true
  }

  async start(data: AdvertiseData): Promise<void> {
    console.log("[MockBLEAdvertiser] Starting with data:", data);
    this.isAdvertising = true;
    this.currentData = data;
    this.callbacks.onStateChange?.("advertising");
  }

  async stop(): Promise<void> {
    console.log("[MockBLEAdvertiser] Stopping");
    this.isAdvertising = false;
    this.callbacks.onStateChange?.("idle");
  }

  async updateData(data: Partial<AdvertiseData>): Promise<void> {
    if (!this.currentData) return;
    this.currentData = { ...this.currentData, ...data };
    console.log("[MockBLEAdvertiser] Updated data:", this.currentData);
  }

  async getState(): Promise<AdvertiserState> {
    return this.isAdvertising ? "advertising" : "idle";
  }

  // Simulate receiving a connection request (for testing)
  simulateConnectionRequest(payload: ConnectionRequestPayload): void {
    console.log("[MockBLEAdvertiser] Simulated connection request:", payload);
    this.callbacks.onConnectionRequest?.(payload);
  }

  destroy(): void {
    this.stop();
  }

  getIsAdvertising(): boolean {
    return this.isAdvertising;
  }

  getCurrentData(): AdvertiseData | null {
    return this.currentData;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let advertiserInstance: BLEAdvertiser | null = null;

export function createBLEAdvertiser(
  callbacks?: AdvertiserCallbacks,
): BLEAdvertiser {
  if (advertiserInstance) {
    advertiserInstance.destroy();
  }
  advertiserInstance = new BLEAdvertiser(callbacks);
  return advertiserInstance;
}

export function getBLEAdvertiser(): BLEAdvertiser | null {
  return advertiserInstance;
}
