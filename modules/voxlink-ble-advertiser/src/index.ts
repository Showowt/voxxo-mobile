/**
 * Voxxo BLE Advertiser Module
 *
 * Expo native module for BLE peripheral advertising.
 * Enables device discovery by other Voxxo users.
 *
 * @version 1.0.0
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";

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
  language: string;
  status: number;
}

export interface ConnectionRequestPayload {
  fromSessionId: string;
  fromLanguage: string;
  roomCode: string;
}

export interface AdvertiserError {
  code: string;
  message: string;
}

// Event types
export type StateChangeEvent = { state: AdvertiserState };
export type ConnectionRequestEvent = ConnectionRequestPayload;
export type ErrorEvent = AdvertiserError;

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface VoxLinkBLEAdvertiserModuleType {
  startAdvertising(data: AdvertiseData): Promise<void>;
  stopAdvertising(): Promise<void>;
  updateAdvertiseData(data: Partial<AdvertiseData>): Promise<void>;
  isAdvertisingSupported(): Promise<boolean>;
  getState(): Promise<AdvertiserState>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const NativeModule = NativeModules.VoxLinkBLEAdvertiser as
  | VoxLinkBLEAdvertiserModuleType
  | undefined;

// Create event emitter only if module exists
const emitter = NativeModule
  ? new NativeEventEmitter(NativeModules.VoxLinkBLEAdvertiser)
  : null;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if BLE advertising is supported on this device
 */
export async function isAdvertisingSupported(): Promise<boolean> {
  if (!NativeModule) {
    return false;
  }
  return NativeModule.isAdvertisingSupported();
}

/**
 * Start BLE advertising with the given data
 */
export async function startAdvertising(data: AdvertiseData): Promise<void> {
  if (!NativeModule) {
    throw new Error("VoxLinkBLEAdvertiser native module not available");
  }
  return NativeModule.startAdvertising(data);
}

/**
 * Stop BLE advertising
 */
export async function stopAdvertising(): Promise<void> {
  if (!NativeModule) {
    return;
  }
  return NativeModule.stopAdvertising();
}

/**
 * Update advertising data while advertising
 */
export async function updateAdvertiseData(
  data: Partial<AdvertiseData>,
): Promise<void> {
  if (!NativeModule) {
    return;
  }
  return NativeModule.updateAdvertiseData(data);
}

/**
 * Get current advertiser state
 */
export async function getState(): Promise<AdvertiserState> {
  if (!NativeModule) {
    return "idle";
  }
  return NativeModule.getState();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

interface EmitterSubscription {
  remove: () => void;
}

/**
 * Subscribe to state change events
 */
export function addStateChangeListener(
  listener: (event: StateChangeEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onStateChange", listener);
}

/**
 * Subscribe to connection request events
 */
export function addConnectionRequestListener(
  listener: (event: ConnectionRequestEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onConnectionRequest", listener);
}

/**
 * Subscribe to error events
 */
export function addErrorListener(
  listener: (event: ErrorEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onError", listener);
}

export default {
  isAdvertisingSupported,
  startAdvertising,
  stopAdvertising,
  updateAdvertiseData,
  getState,
  addStateChangeListener,
  addConnectionRequestListener,
  addErrorListener,
};
