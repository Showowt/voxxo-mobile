/**
 * VoxLink Call Audio Module
 *
 * Enables Wingman AI to listen to phone calls and provide
 * real-time suggestions via AirPods whisper.
 *
 * @version 2.0.0
 */

import { NativeModules, NativeEventEmitter } from "react-native";
import type {
  CallState,
  CallAudioConfig,
  CallStateChangeEvent,
  TranscriptionEvent,
  AudioLevelEvent,
  ErrorEvent,
} from "./types";

// Re-export types
export * from "./types";

// ─── Native Module Interface ─────────────────────────────────────────────────

interface VoxlinkCallAudioModuleType {
  isCallActive(): Promise<boolean>;
  getCallState(): Promise<CallState>;
  isSupported(): Promise<boolean>;
  startCallWingman(config: CallAudioConfig): Promise<void>;
  stopCallWingman(): Promise<void>;
  enableSpeaker(): Promise<void>;
  disableSpeaker(): Promise<void>;
  routeOutputToAirPods(): Promise<boolean>;
  routeOutputToSpeaker(): Promise<boolean>;
  getAvailableOutputDevices(): Promise<string[]>;
}

// ─── Event Subscription Type ─────────────────────────────────────────────────

interface EventSubscription {
  remove: () => void;
}

// ─── Mock Implementation ─────────────────────────────────────────────────────

const mockCallState: CallState = {
  isActive: false,
  direction: "unknown",
  duration: 0,
  isSpeakerOn: false,
  isCapturing: false,
};

// ─── Load Native Module ──────────────────────────────────────────────────────

const NativeModule = NativeModules.VoxlinkCallAudio as
  | VoxlinkCallAudioModuleType
  | undefined;

// Create event emitter only if module exists
const emitter = NativeModule
  ? new NativeEventEmitter(NativeModules.VoxlinkCallAudio)
  : null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if the call audio feature is supported on this device
 */
export async function isSupported(): Promise<boolean> {
  if (!NativeModule) {
    return false;
  }
  return NativeModule.isSupported();
}

/**
 * Check if a phone call is currently active
 */
export async function isCallActive(): Promise<boolean> {
  if (!NativeModule) {
    return false;
  }
  return NativeModule.isCallActive();
}

/**
 * Get the current call state
 */
export async function getCallState(): Promise<CallState> {
  if (!NativeModule) {
    return mockCallState;
  }
  return NativeModule.getCallState();
}

/**
 * Start Wingman mode for the active call
 */
export async function startCallWingman(
  config: Partial<CallAudioConfig> = {},
): Promise<void> {
  const fullConfig: CallAudioConfig = {
    enableSpeaker: true,
    enableNoiseCancellation: true,
    outputDevice: "airpods",
    captureMode: "ambient",
    language: "en-US",
    ...config,
  };
  if (!NativeModule) {
    console.log("[VoxlinkCallAudio Mock] startCallWingman", fullConfig);
    return;
  }
  return NativeModule.startCallWingman(fullConfig);
}

/**
 * Stop Wingman mode
 */
export async function stopCallWingman(): Promise<void> {
  if (!NativeModule) {
    console.log("[VoxlinkCallAudio Mock] stopCallWingman");
    return;
  }
  return NativeModule.stopCallWingman();
}

/**
 * Enable speaker mode
 */
export async function enableSpeaker(): Promise<void> {
  if (!NativeModule) {
    console.log("[VoxlinkCallAudio Mock] enableSpeaker");
    mockCallState.isSpeakerOn = true;
    return;
  }
  return NativeModule.enableSpeaker();
}

/**
 * Disable speaker mode
 */
export async function disableSpeaker(): Promise<void> {
  if (!NativeModule) {
    console.log("[VoxlinkCallAudio Mock] disableSpeaker");
    mockCallState.isSpeakerOn = false;
    return;
  }
  return NativeModule.disableSpeaker();
}

/**
 * Route audio output to AirPods
 */
export async function routeOutputToAirPods(): Promise<boolean> {
  if (!NativeModule) {
    console.log("[VoxlinkCallAudio Mock] routeOutputToAirPods");
    return true;
  }
  return NativeModule.routeOutputToAirPods();
}

/**
 * Route audio output to speaker
 */
export async function routeOutputToSpeaker(): Promise<boolean> {
  if (!NativeModule) {
    console.log("[VoxlinkCallAudio Mock] routeOutputToSpeaker");
    return true;
  }
  return NativeModule.routeOutputToSpeaker();
}

/**
 * Get available audio output devices
 */
export async function getAvailableOutputDevices(): Promise<string[]> {
  if (!NativeModule) {
    return ["speaker", "airpods"];
  }
  return NativeModule.getAvailableOutputDevices();
}

// ─── Event Subscriptions ─────────────────────────────────────────────────────

// Mock subscription for when emitter is not available
const mockSubscription: EventSubscription = {
  remove: () => {},
};

/**
 * Subscribe to call state changes
 */
export function addCallStateListener(
  callback: (event: CallStateChangeEvent) => void,
): EventSubscription {
  if (!emitter) return mockSubscription;
  return emitter.addListener("onCallStateChange", callback);
}

/**
 * Subscribe to transcription results
 */
export function addTranscriptionListener(
  callback: (event: TranscriptionEvent) => void,
): EventSubscription {
  if (!emitter) return mockSubscription;
  return emitter.addListener("onTranscription", callback);
}

/**
 * Subscribe to audio level changes
 */
export function addAudioLevelListener(
  callback: (event: AudioLevelEvent) => void,
): EventSubscription {
  if (!emitter) return mockSubscription;
  return emitter.addListener("onAudioLevel", callback);
}

/**
 * Subscribe to error events
 */
export function addErrorListener(
  callback: (event: ErrorEvent) => void,
): EventSubscription {
  if (!emitter) return mockSubscription;
  return emitter.addListener("onError", callback);
}

// Default export
export default {
  isSupported,
  isCallActive,
  getCallState,
  startCallWingman,
  stopCallWingman,
  enableSpeaker,
  disableSpeaker,
  routeOutputToAirPods,
  routeOutputToSpeaker,
  getAvailableOutputDevices,
  addCallStateListener,
  addTranscriptionListener,
  addAudioLevelListener,
  addErrorListener,
};
