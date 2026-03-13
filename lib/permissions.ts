/**
 * Entrevoz Permission Service
 *
 * Handles runtime permissions for Bluetooth, Microphone, and Speech Recognition.
 * Platform-aware implementation for iOS and Android.
 *
 * @version 2.0.0
 */

import {
  Platform,
  Linking,
  Alert,
  PermissionsAndroid,
  NativeModules,
} from "react-native";
import * as ExpoDevice from "expo-device";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "restricted"
  | "unavailable";

export interface PermissionResult {
  status: PermissionStatus;
  canAskAgain: boolean;
  message?: string;
}

export interface AllPermissionsResult {
  bluetooth: PermissionResult;
  microphone: PermissionResult;
  speechRecognition: PermissionResult;
  allGranted: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if Bluetooth is available and enabled.
 * Note: Actual BLE permission checking requires native module integration.
 */
export async function checkBluetoothPermission(): Promise<PermissionResult> {
  // On simulators, BLE is not available
  if (!ExpoDevice.isDevice) {
    return {
      status: "unavailable",
      canAskAgain: false,
      message: "Bluetooth requires a physical device",
    };
  }

  // For now, assume granted if on device
  // Real implementation would use native BLE state checks
  return {
    status: "granted",
    canAskAgain: true,
  };
}

/**
 * Check microphone permission status.
 */
export async function checkMicrophonePermission(): Promise<PermissionResult> {
  try {
    if (Platform.OS === "android") {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return {
        status: result ? "granted" : "undetermined",
        canAskAgain: true,
      };
    }

    // iOS: Check via native module if available, otherwise assume undetermined
    // The native CallWingmanModule will request permission when starting capture
    return {
      status: "undetermined",
      canAskAgain: true,
    };
  } catch (error) {
    console.error("[Permissions] Failed to check microphone:", error);
    return {
      status: "undetermined",
      canAskAgain: true,
      message: "Unable to check microphone permission",
    };
  }
}

/**
 * Check speech recognition permission (iOS only, Android uses microphone).
 */
export async function checkSpeechRecognitionPermission(): Promise<PermissionResult> {
  // Android doesn't have separate speech recognition permission
  if (Platform.OS === "android") {
    return checkMicrophonePermission();
  }

  // iOS: Speech recognition is a separate permission
  // For now, we'll check via the speech recognition library when available
  // This is a placeholder that assumes permission state based on mic permission
  const micPermission = await checkMicrophonePermission();
  return {
    status: micPermission.status,
    canAskAgain: micPermission.canAskAgain,
    message:
      "Speech recognition permission tied to microphone on this platform",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request microphone permission.
 */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  try {
    if (Platform.OS === "android") {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message:
            "Entrevoz needs microphone access for voice translation and Call Wingman phone coaching",
          buttonNeutral: "Ask Later",
          buttonNegative: "Deny",
          buttonPositive: "Allow",
        },
      );

      const status = mapAndroidResult(result);
      return {
        status,
        canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        message: status === "denied" ? "Microphone access denied" : undefined,
      };
    }

    // iOS: Permission will be requested when native module starts audio capture
    // The system will show the permission dialog automatically
    return {
      status: "undetermined",
      canAskAgain: true,
      message: "Permission will be requested when starting audio capture",
    };
  } catch (error) {
    console.error("[Permissions] Failed to request microphone:", error);
    return {
      status: "denied",
      canAskAgain: false,
      message: "Failed to request microphone permission",
    };
  }
}

/**
 * Request all required permissions for Entrevoz.
 */
export async function requestAllPermissions(): Promise<AllPermissionsResult> {
  const [bluetooth, microphone, speechRecognition] = await Promise.all([
    checkBluetoothPermission(),
    requestMicrophonePermission(),
    checkSpeechRecognitionPermission(),
  ]);

  const allGranted =
    bluetooth.status === "granted" &&
    (microphone.status === "granted" || microphone.status === "undetermined") &&
    (speechRecognition.status === "granted" ||
      speechRecognition.status === "undetermined" ||
      speechRecognition.status === "unavailable");

  return {
    bluetooth,
    microphone,
    speechRecognition,
    allGranted,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map Android permission result to our PermissionStatus type.
 */
function mapAndroidResult(result: string): PermissionStatus {
  switch (result) {
    case PermissionsAndroid.RESULTS.GRANTED:
      return "granted";
    case PermissionsAndroid.RESULTS.DENIED:
      return "denied";
    case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
      return "denied";
    default:
      return "undetermined";
  }
}

/**
 * Open device settings for permission management.
 */
export async function openSettings(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await Linking.openURL("app-settings:");
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    console.error("[Permissions] Failed to open settings:", error);
  }
}

/**
 * Show permission denied alert with option to open settings.
 */
export function showPermissionDeniedAlert(
  permissionName: string,
  onOpenSettings?: () => void,
): void {
  Alert.alert(
    `${permissionName} Permission Required`,
    `Entrevoz needs ${permissionName.toLowerCase()} access for real-time translation. Please enable it in Settings.`,
    [
      { text: "Not Now", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => {
          openSettings();
          onOpenSettings?.();
        },
      },
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if running on a physical device (required for BLE).
 */
export function isPhysicalDevice(): boolean {
  return ExpoDevice.isDevice ?? false;
}

/**
 * Get device platform for conditional logic.
 */
export function getPlatform(): "ios" | "android" | "web" {
  return Platform.OS as "ios" | "android" | "web";
}

/**
 * Check if BLE is supported on this device.
 */
export function isBLESupported(): boolean {
  // BLE requires physical device and iOS 10+ or Android 5.0+
  if (!isPhysicalDevice()) {
    return false;
  }

  if (Platform.OS === "ios") {
    // iOS 10+ supports BLE (we target iOS 13+)
    return true;
  }

  if (Platform.OS === "android") {
    // Android 5.0+ (API 21+) supports BLE
    const apiLevel = Platform.Version;
    return typeof apiLevel === "number" && apiLevel >= 21;
  }

  return false;
}
