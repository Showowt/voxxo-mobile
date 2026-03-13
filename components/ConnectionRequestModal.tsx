/**
 * ConnectionRequestModal Component
 *
 * Modal for incoming connection requests with countdown timer.
 *
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { ConnectionRequest } from "../types";
import { getLanguageByCode } from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ConnectionRequestModalProps {
  request: ConnectionRequest;
  onAccept: () => void;
  onReject: () => void;
  defaultTimeout?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ConnectionRequestModal({
  request,
  onAccept,
  onReject,
  defaultTimeout = 60,
}: ConnectionRequestModalProps) {
  const language = getLanguageByCode(request.fromLanguage);

  // Calculate remaining time
  const calculateRemainingTime = useCallback((): number => {
    const remaining = Math.max(
      0,
      Math.ceil((request.expiresAt - Date.now()) / 1000),
    );
    return Math.min(remaining, defaultTimeout);
  }, [request.expiresAt, defaultTimeout]);

  const [timeRemaining, setTimeRemaining] = React.useState(
    calculateRemainingTime,
  );

  // Animation values
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);
  const modalScale = useSharedValue(0.8);
  const modalOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.8);

  // Entry animation and haptic feedback
  useEffect(() => {
    // Haptic feedback on mount
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Modal entrance animation
    modalScale.value = withSpring(1, {
      damping: 15,
      stiffness: 120,
    });
    modalOpacity.value = withTiming(1, { duration: 200 });

    // Pulsing avatar animation
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Expanding ring animation
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
      false,
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
        withTiming(0.8, { duration: 0 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateRemainingTime();
      setTimeRemaining(remaining);

      // Haptic feedback at 10 seconds
      if (remaining === 10) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Haptic feedback at 5 seconds and below
      if (remaining <= 5 && remaining > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Auto-reject when time runs out
      if (remaining <= 0) {
        clearInterval(timer);
        onReject();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateRemainingTime, onReject]);

  // Animated styles
  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: modalOpacity.value,
  }));

  // Button handlers with haptics
  const handleAccept = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAccept();
  }, [onAccept]);

  const handleReject = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReject();
  }, [onReject]);

  // Format countdown display
  const formatTime = (seconds: number): string => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  // Get timer color based on remaining time
  const getTimerColor = (): string => {
    if (timeRemaining <= 10) return "#ef4444"; // red
    if (timeRemaining <= 30) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.modal, modalAnimatedStyle]}>
          {/* Header */}
          <Text style={styles.headerText}>Incoming Request</Text>

          {/* Avatar with pulse animation */}
          <View style={styles.avatarContainer}>
            {/* Expanding ring */}
            <Animated.View style={[styles.ring, ringAnimatedStyle]} />

            {/* Avatar */}
            <Animated.View style={[styles.avatar, avatarAnimatedStyle]}>
              <Text style={styles.flagEmoji}>{language.flag}</Text>
            </Animated.View>
          </View>

          {/* Language info */}
          <View style={styles.languageInfo}>
            <Text style={styles.languageName}>{language.name}</Text>
            <Text style={styles.nativeName}>{language.nativeName}</Text>
          </View>

          {/* Countdown timer */}
          <View style={styles.timerContainer}>
            <Text style={[styles.timerText, { color: getTimerColor() }]}>
              {formatTime(timeRemaining)}
            </Text>
            <Text style={styles.timerLabel}>Time remaining</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${(timeRemaining / defaultTimeout) * 100}%`,
                  backgroundColor: getTimerColor(),
                },
              ]}
            />
          </View>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={handleReject}
              activeOpacity={0.7}
            >
              <Text style={styles.rejectButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.7}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#18181b",
    borderRadius: 24,
    padding: 32,
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    alignItems: "center",
  },
  headerText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  ring: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#3b82f6",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#3b82f6",
  },
  flagEmoji: {
    fontSize: 50,
  },
  languageInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  languageName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  nativeName: {
    color: "#a1a1aa",
    fontSize: 18,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  timerText: {
    fontSize: 48,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timerLabel: {
    color: "#71717a",
    fontSize: 14,
    marginTop: 4,
  },
  progressBarContainer: {
    width: "100%",
    height: 4,
    backgroundColor: "#27272a",
    borderRadius: 2,
    marginBottom: 28,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#27272a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "700",
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#22c55e",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default ConnectionRequestModal;
