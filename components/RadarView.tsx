/**
 * Entrevoz RadarView Component
 *
 * Animated radar display showing nearby BLE users with distance-based positioning.
 *
 * @version 1.0.0
 */

import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import type { NearbyUser } from "../types";
import { DISTANCE_CONFIG, getLanguageByCode } from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RadarViewProps {
  users: NearbyUser[];
  myLanguage: string;
  selectedUserId: string | null;
  onSelectUser: (user: NearbyUser) => void;
  isScanning: boolean;
}

interface UserBubbleProps {
  user: NearbyUser;
  position: { x: number; y: number };
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const RADAR_SIZE = Math.min(Dimensions.get("window").width - 48, 320);
const RADAR_CENTER = RADAR_SIZE / 2;

// Distance thresholds in meters (matching BLE constants)
const RING_THRESHOLDS = [
  DISTANCE_CONFIG.IMMEDIATE_THRESHOLD, // 3m
  DISTANCE_CONFIG.NEAR_THRESHOLD, // 10m
  DISTANCE_CONFIG.FAR_THRESHOLD, // 30m
];

// Golden angle in radians for optimal distribution
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Animation durations
const SWEEP_DURATION = 4000;
const PULSE_DURATION = 2000;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate position on radar based on distance using golden angle distribution
 */
function calculateUserPosition(
  distance: number,
  index: number,
  maxDistance: number = RING_THRESHOLDS[2],
): { x: number; y: number } {
  // Normalize distance to radar radius (0.15 to 0.9 of radar to avoid edges)
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  const radius = 0.15 + normalizedDistance * 0.75;

  // Use golden angle for even distribution
  const angle = index * GOLDEN_ANGLE;

  // Convert polar to cartesian coordinates
  const x = RADAR_CENTER + Math.cos(angle) * radius * RADAR_CENTER;
  const y = RADAR_CENTER + Math.sin(angle) * radius * RADAR_CENTER;

  return { x, y };
}

/**
 * Get flag emoji for language code
 */
function getLanguageFlag(code: string): string {
  const language = getLanguageByCode(code);
  return language.flag;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function UserBubble({
  user,
  position,
  isSelected,
  onSelect,
  index,
}: UserBubbleProps) {
  const scale = useSharedValue(0);
  const highlightScale = useSharedValue(1);
  const highlightOpacity = useSharedValue(0);

  // Entry animation
  useEffect(() => {
    scale.value = withDelay(
      index * 50,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.5)) }),
    );
  }, [index]);

  // Selection highlight animation
  useEffect(() => {
    if (isSelected) {
      highlightOpacity.value = withTiming(1, { duration: 200 });
      highlightScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      highlightOpacity.value = withTiming(0, { duration: 200 });
      cancelAnimation(highlightScale);
      highlightScale.value = 1;
    }
  }, [isSelected]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.x - 24 },
      { translateY: position.y - 24 },
      { scale: scale.value },
    ],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value * 0.4,
    transform: [{ scale: highlightScale.value }],
  }));

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect();
  };

  const flag = getLanguageFlag(user.language);

  return (
    <Animated.View style={[styles.userBubbleContainer, bubbleStyle]}>
      {/* Selection highlight ring */}
      <Animated.View style={[styles.highlightRing, highlightStyle]} />

      <Pressable
        onPress={handlePress}
        style={[styles.userBubble, isSelected && styles.userBubbleSelected]}
      >
        <Text style={styles.userFlag}>{flag}</Text>
      </Pressable>

      {/* Distance label */}
      <View style={styles.distanceLabel}>
        <Text style={styles.distanceText}>
          {user.distance < 1
            ? `${Math.round(user.distance * 100)}cm`
            : `${user.distance.toFixed(1)}m`}
        </Text>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RadarView({
  users,
  myLanguage,
  selectedUserId,
  onSelectUser,
  isScanning,
}: RadarViewProps) {
  // Animation values
  const sweepRotation = useSharedValue(0);
  const centerPulse = useSharedValue(1);
  const scanningOpacity = useSharedValue(1);

  // Sweep rotation animation
  useEffect(() => {
    if (isScanning) {
      sweepRotation.value = withRepeat(
        withTiming(360, {
          duration: SWEEP_DURATION,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
      scanningOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1000 }),
          withTiming(1, { duration: 1000 }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(sweepRotation);
      cancelAnimation(scanningOpacity);
      scanningOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [isScanning]);

  // Center pulse animation
  useEffect(() => {
    centerPulse.value = withRepeat(
      withSequence(
        withTiming(1.15, {
          duration: PULSE_DURATION / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: PULSE_DURATION / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );
  }, []);

  // Animated styles
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweepRotation.value}deg` }],
    opacity: interpolate(scanningOpacity.value, [0.3, 1], [0.3, 0.6]),
  }));

  const centerPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerPulse.value }],
  }));

  const scanningTextStyle = useAnimatedStyle(() => ({
    opacity: scanningOpacity.value,
  }));

  // Calculate user positions with memoization
  const userPositions = useMemo(() => {
    return users.map((user, index) => ({
      user,
      position: calculateUserPosition(user.distance, index),
    }));
  }, [users]);

  const myFlag = getLanguageFlag(myLanguage);

  const handleSelectUser = async (user: NearbyUser) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSelectUser(user);
  };

  return (
    <View style={styles.container}>
      {/* Radar display */}
      <View style={styles.radarContainer}>
        {/* Concentric rings */}
        {RING_THRESHOLDS.map((threshold, index) => {
          const ringSize = ((index + 1) / RING_THRESHOLDS.length) * RADAR_SIZE;
          return (
            <View
              key={threshold}
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                },
              ]}
            >
              {/* Distance label on ring */}
              <View style={styles.ringLabel}>
                <Text style={styles.ringLabelText}>{threshold}m</Text>
              </View>
            </View>
          );
        })}

        {/* Radar sweep */}
        <Animated.View style={[styles.sweepContainer, sweepStyle]}>
          <View style={styles.sweep} />
        </Animated.View>

        {/* Cross hairs */}
        <View style={styles.crosshairHorizontal} />
        <View style={styles.crosshairVertical} />

        {/* User bubbles */}
        {userPositions.map(({ user, position }, index) => (
          <UserBubble
            key={user.id}
            user={user}
            position={position}
            isSelected={selectedUserId === user.id}
            onSelect={() => handleSelectUser(user)}
            index={index}
          />
        ))}

        {/* Center indicator (my position) */}
        <View style={styles.centerContainer}>
          <Animated.View style={[styles.centerPulseRing, centerPulseStyle]} />
          <View style={styles.centerIndicator}>
            <Text style={styles.centerFlag}>{myFlag}</Text>
          </View>
        </View>
      </View>

      {/* User count and status */}
      <Animated.View style={[styles.statusContainer, scanningTextStyle]}>
        <Text style={styles.userCount}>
          {users.length === 0
            ? "No users nearby"
            : users.length === 1
              ? "1 user nearby"
              : `${users.length} users nearby`}
        </Text>
        {isScanning && <Text style={styles.scanningText}>Scanning...</Text>}
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    backgroundColor: "#09090b",
    borderRadius: RADAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#27272a",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  ringLabel: {
    position: "absolute",
    top: 4,
  },
  ringLabelText: {
    color: "#52525b",
    fontSize: 10,
    fontWeight: "500",
  },
  sweepContainer: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
  },
  sweep: {
    position: "absolute",
    top: RADAR_CENTER,
    left: RADAR_CENTER,
    width: RADAR_CENTER,
    height: 2,
    backgroundColor: "#22c55e",
    opacity: 0.6,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    transformOrigin: "left center",
  },
  crosshairHorizontal: {
    position: "absolute",
    width: RADAR_SIZE,
    height: 1,
    backgroundColor: "#27272a",
    opacity: 0.5,
  },
  crosshairVertical: {
    position: "absolute",
    width: 1,
    height: RADAR_SIZE,
    backgroundColor: "#27272a",
    opacity: 0.5,
  },
  centerContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerPulseRing: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#22c55e",
    opacity: 0.4,
  },
  centerIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#18181b",
    borderWidth: 3,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  centerFlag: {
    fontSize: 24,
  },
  userBubbleContainer: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightRing: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#3b82f6",
    backgroundColor: "transparent",
  },
  userBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#18181b",
    borderWidth: 2,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  userBubbleSelected: {
    borderColor: "#3b82f6",
    borderWidth: 3,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  userFlag: {
    fontSize: 22,
  },
  distanceLabel: {
    position: "absolute",
    bottom: -6,
    backgroundColor: "#27272a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distanceText: {
    color: "#a1a1aa",
    fontSize: 9,
    fontWeight: "600",
  },
  statusContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  userCount: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  scanningText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
});
