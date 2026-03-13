/**
 * Entrevoz BLE Service
 *
 * Mock implementation for build testing.
 * Will be replaced with real BLE once compatibility is confirmed.
 *
 * @version 2.0.0 (Mock)
 */

import { Platform } from "react-native";
import {
  VOXXO_SERVICE_UUID,
  BLE_SCAN_OPTIONS,
  DISTANCE_CONFIG,
  USER_STATUS,
  type LanguageCode,
  type UserStatus,
  type DistanceCategory,
} from "../constants/ble";
import type { NearbyUser } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK BLE STATE
// ═══════════════════════════════════════════════════════════════════════════════

export const State = {
  Unknown: "Unknown",
  Resetting: "Resetting",
  Unsupported: "Unsupported",
  Unauthorized: "Unauthorized",
  PoweredOff: "PoweredOff",
  PoweredOn: "PoweredOn",
} as const;

export type BLEState = (typeof State)[keyof typeof State];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BLEServiceConfig {
  onUserDiscovered: (user: NearbyUser) => void;
  onUserLost: (userId: string) => void;
  onUserUpdated: (user: NearbyUser) => void;
  onStateChange: (state: BLEState) => void;
  onError: (error: BLEServiceError) => void;
}

export interface BLEServiceError {
  code: string;
  message: string;
  recoverable: boolean;
  originalError?: Error;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK BLE SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class BLEService {
  private config: BLEServiceConfig;
  private isInitialized: boolean = false;
  private isScanning: boolean = false;
  private mockUsers: Map<string, NearbyUser> = new Map();
  private simulationInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: BLEServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Simulate initialization
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.config.onStateChange(State.PoweredOn);
    this.isInitialized = true;
  }

  async startScanning(): Promise<void> {
    if (!this.isInitialized || this.isScanning) return;

    this.isScanning = true;
    this.startSimulation();
  }

  async stopScanning(): Promise<void> {
    this.isScanning = false;
    this.stopSimulation();
  }

  destroy(): void {
    this.stopSimulation();
    this.mockUsers.clear();
    this.isInitialized = false;
  }

  private startSimulation(): void {
    const languages: LanguageCode[] = ["es", "fr", "de", "zh", "ja", "pt"];

    this.simulationInterval = setInterval(() => {
      // Randomly add, update, or remove users
      const action = Math.random();

      if (action < 0.3 && this.mockUsers.size < 5) {
        // Add new user
        const id = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const lang = languages[Math.floor(Math.random() * languages.length)];
        const distance = 2 + Math.random() * 25;

        const user: NearbyUser = {
          id,
          deviceId: `device-${id}`,
          language: lang,
          status: USER_STATUS.AVAILABLE,
          distance,
          distanceCategory:
            distance < 3 ? "immediate" : distance < 10 ? "near" : "far",
          rssi: -50 - Math.random() * 40,
          smoothedRssi: -70,
          lastSeen: Date.now(),
          firstSeen: Date.now(),
        };

        this.mockUsers.set(id, user);
        this.config.onUserDiscovered(user);
      } else if (action < 0.7 && this.mockUsers.size > 0) {
        // Update random user
        const users = Array.from(this.mockUsers.values());
        const user = users[Math.floor(Math.random() * users.length)];
        const newDistance = Math.max(
          0.5,
          user.distance + (Math.random() - 0.5) * 3,
        );

        const updated: NearbyUser = {
          ...user,
          distance: newDistance,
          distanceCategory:
            newDistance < 3 ? "immediate" : newDistance < 10 ? "near" : "far",
          lastSeen: Date.now(),
        };

        this.mockUsers.set(user.id, updated);
        this.config.onUserUpdated(updated);
      } else if (action > 0.9 && this.mockUsers.size > 2) {
        // Remove random user
        const users = Array.from(this.mockUsers.keys());
        const id = users[Math.floor(Math.random() * users.length)];
        this.mockUsers.delete(id);
        this.config.onUserLost(id);
      }
    }, 2000);
  }

  private stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  get scanning(): boolean {
    return this.isScanning;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  getTrackedUsers(): NearbyUser[] {
    return Array.from(this.mockUsers.values());
  }

  getTrackedUser(userId: string): NearbyUser | undefined {
    return this.mockUsers.get(userId);
  }

  async getState(): Promise<BLEState> {
    return this.isInitialized ? State.PoweredOn : State.Unknown;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

let bleServiceInstance: BLEService | null = null;

export function createBLEService(config: BLEServiceConfig): BLEService {
  if (bleServiceInstance) {
    bleServiceInstance.destroy();
  }
  bleServiceInstance = new BLEService(config);
  return bleServiceInstance;
}

export function getBLEService(): BLEService | null {
  return bleServiceInstance;
}

export function destroyBLEService(): void {
  if (bleServiceInstance) {
    bleServiceInstance.destroy();
    bleServiceInstance = null;
  }
}
