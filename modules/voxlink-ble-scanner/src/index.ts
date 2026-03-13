/**
 * Voxxo BLE Scanner Module
 *
 * Expo native module for BLE central scanning.
 * Discovers nearby Voxxo users advertising their presence.
 *
 * @version 1.0.0
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ScannerState =
  | "idle"
  | "starting"
  | "scanning"
  | "stopping"
  | "error";

export type BluetoothState =
  | "unknown"
  | "resetting"
  | "unsupported"
  | "unauthorized"
  | "poweredOff"
  | "poweredOn";

export interface DiscoveredDevice {
  /** Unique device identifier */
  deviceId: string;
  /** Session ID from the Voxxo service characteristic */
  sessionId: string;
  /** Language code (ISO 639-1) */
  language: string;
  /** User status (1=available, 2=busy, etc.) */
  status: number;
  /** Signal strength in dBm */
  rssi: number;
  /** Estimated distance in meters */
  distance: number;
  /** Timestamp of last seen */
  lastSeen: number;
}

export interface ScanOptions {
  /** Scan duration in milliseconds (0 = continuous) */
  duration?: number;
  /** Allow duplicate device reports for RSSI updates */
  allowDuplicates?: boolean;
  /** Scan mode on Android: 0=low_power, 1=balanced, 2=low_latency */
  scanMode?: number;
}

export interface ScannerError {
  code: string;
  message: string;
}

// Event types
export type StateChangeEvent = { state: ScannerState };
export type BluetoothStateChangeEvent = { state: BluetoothState };
export type DeviceDiscoveredEvent = DiscoveredDevice;
export type DeviceLostEvent = { deviceId: string };
export type ErrorEvent = ScannerError;

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface VoxLinkBLEScannerModuleType {
  startScanning(options?: ScanOptions): Promise<void>;
  stopScanning(): Promise<void>;
  getState(): Promise<ScannerState>;
  getBluetoothState(): Promise<BluetoothState>;
  isScanningSupported(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  connectToDevice(deviceId: string): Promise<void>;
  sendConnectionRequest(
    deviceId: string,
    sessionId: string,
    language: string,
    roomCode: string,
  ): Promise<void>;
  disconnectFromDevice(deviceId: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const NativeModule = NativeModules.VoxLinkBLEScanner as
  | VoxLinkBLEScannerModuleType
  | undefined;

// Create event emitter only if module exists
const emitter = NativeModule
  ? new NativeEventEmitter(NativeModules.VoxLinkBLEScanner)
  : null;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if BLE scanning is supported on this device
 */
export async function isScanningSupported(): Promise<boolean> {
  if (!NativeModule) {
    return false;
  }
  return NativeModule.isScanningSupported();
}

/**
 * Request necessary BLE permissions
 */
export async function requestPermissions(): Promise<boolean> {
  if (!NativeModule) {
    return false;
  }
  return NativeModule.requestPermissions();
}

/**
 * Get current Bluetooth state
 */
export async function getBluetoothState(): Promise<BluetoothState> {
  if (!NativeModule) {
    return "unknown";
  }
  return NativeModule.getBluetoothState();
}

/**
 * Start BLE scanning for nearby Voxxo users
 */
export async function startScanning(options?: ScanOptions): Promise<void> {
  if (!NativeModule) {
    throw new Error("VoxLinkBLEScanner native module not available");
  }
  return NativeModule.startScanning(options);
}

/**
 * Stop BLE scanning
 */
export async function stopScanning(): Promise<void> {
  if (!NativeModule) {
    return;
  }
  return NativeModule.stopScanning();
}

/**
 * Get current scanner state
 */
export async function getState(): Promise<ScannerState> {
  if (!NativeModule) {
    return "idle";
  }
  return NativeModule.getState();
}

/**
 * Connect to a discovered device to read characteristics
 */
export async function connectToDevice(deviceId: string): Promise<void> {
  if (!NativeModule) {
    throw new Error("VoxLinkBLEScanner native module not available");
  }
  return NativeModule.connectToDevice(deviceId);
}

/**
 * Send a connection request to a device
 */
export async function sendConnectionRequest(
  deviceId: string,
  sessionId: string,
  language: string,
  roomCode: string,
): Promise<void> {
  if (!NativeModule) {
    throw new Error("VoxLinkBLEScanner native module not available");
  }
  return NativeModule.sendConnectionRequest(
    deviceId,
    sessionId,
    language,
    roomCode,
  );
}

/**
 * Disconnect from a device
 */
export async function disconnectFromDevice(deviceId: string): Promise<void> {
  if (!NativeModule) {
    return;
  }
  return NativeModule.disconnectFromDevice(deviceId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

interface EmitterSubscription {
  remove: () => void;
}

/**
 * Subscribe to scanner state change events
 */
export function addStateChangeListener(
  listener: (event: StateChangeEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onStateChange", listener);
}

/**
 * Subscribe to Bluetooth state change events
 */
export function addBluetoothStateChangeListener(
  listener: (event: BluetoothStateChangeEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onBluetoothStateChange", listener);
}

/**
 * Subscribe to device discovered events
 */
export function addDeviceDiscoveredListener(
  listener: (event: DeviceDiscoveredEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onDeviceDiscovered", listener);
}

/**
 * Subscribe to device lost events (device no longer visible)
 */
export function addDeviceLostListener(
  listener: (event: DeviceLostEvent) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener("onDeviceLost", listener);
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
  isScanningSupported,
  requestPermissions,
  getBluetoothState,
  startScanning,
  stopScanning,
  getState,
  connectToDevice,
  sendConnectionRequest,
  disconnectFromDevice,
  addStateChangeListener,
  addBluetoothStateChangeListener,
  addDeviceDiscoveredListener,
  addDeviceLostListener,
  addErrorListener,
};
