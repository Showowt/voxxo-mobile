/**
 * UserCard Component
 *
 * Displays selected nearby user info with connect action.
 *
 * @version 1.0.0
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import type { NearbyUser } from "../types";
import { getLanguageByCode, USER_STATUS_LABELS } from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UserCardProps {
  user: NearbyUser;
  onConnect: () => void;
  isConnecting: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function UserCard({ user, onConnect, isConnecting }: UserCardProps) {
  const language = getLanguageByCode(user.language);
  const statusLabel = USER_STATUS_LABELS[user.status];

  // Animated scale for avatar on appearance
  const avatarScale = useSharedValue(0);

  React.useEffect(() => {
    avatarScale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });
  }, []);

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  // Format distance display
  const formatDistance = (meters: number): string => {
    if (meters < 1) {
      return "< 1m";
    }
    if (meters < 10) {
      return `${meters.toFixed(1)}m`;
    }
    return `${Math.round(meters)}m`;
  };

  // Get distance category color
  const getDistanceColor = (): string => {
    switch (user.distanceCategory) {
      case "immediate":
        return "#22c55e"; // green-500
      case "near":
        return "#eab308"; // yellow-500
      case "far":
        return "#ef4444"; // red-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  return (
    <View style={styles.container}>
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
          <View style={styles.avatar}>
            <Text style={styles.flagEmoji}>{language.flag}</Text>
          </View>
          {/* Language badge */}
          <View style={styles.languageBadge}>
            <Text style={styles.languageCode}>
              {user.language.toUpperCase()}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.languageName}>{language.name}</Text>
        <Text style={styles.nativeName}>{language.nativeName}</Text>

        <View style={styles.metaRow}>
          {/* Distance */}
          <View style={styles.metaItem}>
            <View
              style={[
                styles.distanceDot,
                { backgroundColor: getDistanceColor() },
              ]}
            />
            <Text style={styles.metaText}>{formatDistance(user.distance)}</Text>
          </View>

          {/* Status */}
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Signal strength indicator */}
        <View style={styles.signalRow}>
          <Text style={styles.signalLabel}>Signal</Text>
          <View style={styles.signalBars}>
            {[1, 2, 3, 4, 5].map((bar) => (
              <View
                key={bar}
                style={[
                  styles.signalBar,
                  {
                    height: 4 + bar * 3,
                    backgroundColor:
                      user.rssi > -50 - bar * 10 ? "#22c55e" : "#27272a",
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.rssiText}>{user.rssi} dBm</Text>
        </View>
      </View>

      {/* Connect Button */}
      <TouchableOpacity
        style={[
          styles.connectButton,
          isConnecting && styles.connectButtonDisabled,
        ]}
        onPress={onConnect}
        disabled={isConnecting}
        activeOpacity={0.7}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.connectButtonText}>Connect</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#3f3f46",
  },
  flagEmoji: {
    fontSize: 40,
  },
  languageBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  languageCode: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  infoSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  languageName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  nativeName: {
    color: "#a1a1aa",
    fontSize: 16,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    color: "#71717a",
    fontSize: 14,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signalLabel: {
    color: "#52525b",
    fontSize: 12,
  },
  signalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  signalBar: {
    width: 4,
    borderRadius: 2,
  },
  rssiText: {
    color: "#52525b",
    fontSize: 11,
    marginLeft: 4,
  },
  connectButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  connectButtonDisabled: {
    backgroundColor: "#1e40af",
    opacity: 0.7,
  },
  connectButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default UserCard;
