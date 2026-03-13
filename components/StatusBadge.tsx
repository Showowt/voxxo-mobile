/**
 * StatusBadge Component
 *
 * BLE status indicator with colored dot and status text.
 *
 * @version 1.0.0
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import type { BLEState } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  bleState: BLEState;
  isScanning: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

interface StatusConfig {
  color: string;
  text: string;
  animated: boolean;
}

const getStatusConfig = (
  bleState: BLEState,
  isScanning: boolean,
): StatusConfig => {
  // If scanning, show scanning state regardless of bleState
  if (isScanning) {
    return {
      color: "#eab308", // yellow-500
      text: "Scanning",
      animated: true,
    };
  }

  switch (bleState) {
    case "poweredOn":
      return {
        color: "#22c55e", // green-500
        text: "Ready",
        animated: false,
      };

    case "scanning":
      return {
        color: "#eab308", // yellow-500
        text: "Scanning",
        animated: true,
      };

    case "advertising":
      return {
        color: "#3b82f6", // blue-500
        text: "Broadcasting",
        animated: true,
      };

    case "poweredOff":
      return {
        color: "#ef4444", // red-500
        text: "Bluetooth Off",
        animated: false,
      };

    case "unauthorized":
      return {
        color: "#ef4444", // red-500
        text: "Permission Denied",
        animated: false,
      };

    case "unsupported":
      return {
        color: "#ef4444", // red-500
        text: "Not Supported",
        animated: false,
      };

    case "resetting":
      return {
        color: "#f97316", // orange-500
        text: "Resetting",
        animated: true,
      };

    case "unknown":
    default:
      return {
        color: "#6b7280", // gray-500
        text: "Initializing",
        animated: true,
      };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function StatusBadge({ bleState, isScanning }: StatusBadgeProps) {
  const config = getStatusConfig(bleState, isScanning);

  // Animation values
  const dotOpacity = useSharedValue(1);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    if (config.animated) {
      // Pulsing animation for active states
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      dotScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      // Reset to static state
      cancelAnimation(dotOpacity);
      cancelAnimation(dotScale);
      dotOpacity.value = withTiming(1, { duration: 200 });
      dotScale.value = withTiming(1, { duration: 200 });
    }

    return () => {
      cancelAnimation(dotOpacity);
      cancelAnimation(dotScale);
    };
  }, [config.animated]);

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: config.color },
          dotAnimatedStyle,
        ]}
      />
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default StatusBadge;
