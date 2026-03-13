/**
 * Entrevoz Conversation Screen
 *
 * Production-ready face-to-face translation view with:
 * - Split screen: Partner's translated text on top, your speech on bottom
 * - Large microphone button with animated states
 * - Live transcription and translation display
 * - Connection status indicator
 * - Language flags/labels for both sides
 * - Share link functionality
 * - Animated speaking indicators
 *
 * @version 3.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
  Alert,
  Platform,
  Share,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { LANGUAGES, type LanguageCode } from "../constants/ble";
import { useProximityStore } from "../stores/proximityStore";
import { translate } from "../lib/translation";
import {
  createRealtimeService,
  destroyRealtimeService,
  type RealtimeMessage,
  type SpeechPayload,
  type StatusPayload,
  type EndPayload,
} from "../lib/realtime";
import {
  createSpeechRecognitionService,
  destroySpeechRecognitionService,
  useSpeechRecognition,
  type SpeechRecognitionService,
} from "../lib/speech-recognition";
import type { ConversationMessage } from "../types";

const { width, height } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  background: "#030507",
  surface: "#0A0F14",
  surfaceElevated: "#111820",
  border: "#1C2530",
  borderActive: "#00E5A0",
  accent: "#00E5A0",
  accentDim: "rgba(0, 229, 160, 0.15)",
  accentGlow: "rgba(0, 229, 160, 0.3)",
  partnerAccent: "#3B82F6",
  partnerDim: "rgba(59, 130, 246, 0.15)",
  partnerGlow: "rgba(59, 130, 246, 0.3)",
  danger: "#EF4444",
  dangerDim: "rgba(239, 68, 68, 0.15)",
  warning: "#F59E0B",
  text: "#FFFFFF",
  textMuted: "#6B7280",
  textDim: "#3B4654",
  success: "#10B981",
};

// ═══════════════════════════════════════════════════════════════════════════════
// SAFE HAPTICS WRAPPERS
// ═══════════════════════════════════════════════════════════════════════════════

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style).catch(() => {});
  }
};

const triggerNotification = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(type).catch(() => {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED SOUND WAVE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SoundWaveProps {
  isActive: boolean;
  color: string;
  barCount?: number;
}

function SoundWave({ isActive, color, barCount = 5 }: SoundWaveProps) {
  const animations = Array(barCount)
    .fill(0)
    .map(() => useSharedValue(0.3));

  useEffect(() => {
    animations.forEach((anim, index) => {
      if (isActive) {
        const delay = index * 100;
        const duration = 300 + Math.random() * 200;
        setTimeout(() => {
          anim.value = withRepeat(
            withSequence(
              withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
              withTiming(0.3, { duration, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
          );
        }, delay);
      } else {
        anim.value = withTiming(0.3, { duration: 200 });
      }
    });
  }, [isActive]);

  return (
    <View style={soundWaveStyles.container}>
      {animations.map((anim, index) => {
        const barStyle = useAnimatedStyle(() => ({
          height: interpolate(
            anim.value,
            [0.3, 1],
            [8, 24],
            Extrapolation.CLAMP,
          ),
          backgroundColor: color,
          opacity: interpolate(
            anim.value,
            [0.3, 1],
            [0.5, 1],
            Extrapolation.CLAMP,
          ),
        }));

        return (
          <Animated.View key={index} style={[soundWaveStyles.bar, barStyle]} />
        );
      })}
    </View>
  );
}

const soundWaveStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 28,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

interface ConnectionBadgeProps {
  status: "connecting" | "connected" | "reconnecting" | "disconnected";
}

function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [status]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return COLORS.success;
      case "connecting":
      case "reconnecting":
        return COLORS.warning;
      case "disconnected":
        return COLORS.danger;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      case "disconnected":
        return "Disconnected";
    }
  };

  return (
    <View style={badgeStyles.container}>
      <Animated.View
        style={[
          badgeStyles.dot,
          { backgroundColor: getStatusColor() },
          dotStyle,
        ]}
      />
      <Text style={[badgeStyles.text, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE HEADER
// ═══════════════════════════════════════════════════════════════════════════════

interface LanguageHeaderProps {
  language: { code: string; name: string; flag: string } | undefined;
  isPartner?: boolean;
  isActive?: boolean;
  statusText?: string;
}

function LanguageHeader({
  language,
  isPartner = false,
  isActive = false,
  statusText,
}: LanguageHeaderProps) {
  const accentColor = isPartner ? COLORS.partnerAccent : COLORS.accent;

  return (
    <View style={langHeaderStyles.container}>
      <View style={langHeaderStyles.left}>
        <Text style={langHeaderStyles.flag}>{language?.flag || "🌐"}</Text>
        <View>
          <Text style={langHeaderStyles.languageName}>
            {language?.name || "Unknown"}
          </Text>
          <Text style={langHeaderStyles.label}>
            {isPartner ? "Partner" : "You"}
          </Text>
        </View>
      </View>
      {isActive && (
        <View style={langHeaderStyles.right}>
          <SoundWave isActive={true} color={accentColor} barCount={4} />
          {statusText && (
            <Text style={[langHeaderStyles.status, { color: accentColor }]}>
              {statusText}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const langHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flag: {
    fontSize: 32,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  status: {
    fontSize: 12,
    fontWeight: "500",
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPEECH DISPLAY CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface SpeechDisplayProps {
  originalText: string;
  translatedText: string;
  isLive?: boolean;
  isPartner?: boolean;
  placeholder?: string;
}

function SpeechDisplay({
  originalText,
  translatedText,
  isLive = false,
  isPartner = false,
  placeholder = "Waiting...",
}: SpeechDisplayProps) {
  const accentColor = isPartner ? COLORS.partnerAccent : COLORS.accent;
  const dimColor = isPartner ? COLORS.partnerDim : COLORS.accentDim;

  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    if (isLive && originalText) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );
    } else {
      cursorOpacity.value = 0;
    }
  }, [isLive, originalText]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const hasContent = originalText || translatedText;

  return (
    <View
      style={[
        speechStyles.container,
        isLive &&
          hasContent && { borderColor: accentColor, backgroundColor: dimColor },
      ]}
    >
      {hasContent ? (
        <>
          {/* Original text (what was spoken) */}
          <View style={speechStyles.textRow}>
            <Text style={speechStyles.originalText}>
              {originalText}
              {isLive && (
                <Animated.Text style={[speechStyles.cursor, cursorStyle]}>
                  |
                </Animated.Text>
              )}
            </Text>
          </View>

          {/* Translated text */}
          {translatedText && <View style={speechStyles.divider} />}
          {translatedText && (
            <Text style={[speechStyles.translatedText, { color: accentColor }]}>
              {translatedText}
            </Text>
          )}
        </>
      ) : (
        <Text style={speechStyles.placeholder}>{placeholder}</Text>
      )}
    </View>
  );
}

const speechStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
    justifyContent: "center",
  },
  textRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  originalText: {
    fontSize: 22,
    fontWeight: "500",
    color: COLORS.text,
    lineHeight: 32,
  },
  cursor: {
    fontSize: 22,
    fontWeight: "300",
    color: COLORS.accent,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  translatedText: {
    fontSize: 18,
    fontWeight: "400",
    lineHeight: 26,
  },
  placeholder: {
    fontSize: 16,
    color: COLORS.textDim,
    fontStyle: "italic",
    textAlign: "center",
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HISTORY ITEM
// ═══════════════════════════════════════════════════════════════════════════════

interface MessageItemProps {
  message: ConversationMessage;
  isPartner: boolean;
}

function MessageItem({ message, isPartner }: MessageItemProps) {
  const accentColor = isPartner ? COLORS.partnerAccent : COLORS.accent;

  return (
    <View
      style={[
        messageStyles.container,
        isPartner ? messageStyles.partnerMessage : messageStyles.myMessage,
      ]}
    >
      <Text style={messageStyles.original}>{message.originalText}</Text>
      <Text style={[messageStyles.translated, { color: accentColor }]}>
        {message.translatedText}
      </Text>
      <Text style={messageStyles.time}>
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

const messageStyles = StyleSheet.create({
  container: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
  },
  partnerMessage: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.partnerDim,
    borderBottomLeftRadius: 4,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.accentDim,
    borderBottomRightRadius: 4,
  },
  original: {
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 4,
  },
  translated: {
    fontSize: 13,
    fontStyle: "italic",
  },
  time: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "right",
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    roomCode: string;
    partnerLanguage: string;
  }>();

  // Store state
  const { myPresence, conversation, endConversation, setConversation } =
    useProximityStore();

  // Local state
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");
  const [isListening, setIsListening] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<
    "listening" | "speaking" | "idle"
  >("idle");
  const [myLiveText, setMyLiveText] = useState("");
  const [myLiveTranslation, setMyLiveTranslation] = useState("");
  const [partnerLiveText, setPartnerLiveText] = useState("");
  const [partnerLiveTranslation, setPartnerLiveTranslation] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Services refs
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);
  const isTranslatingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Languages
  const myLanguage = myPresence.language;
  const partnerLanguage = (params.partnerLanguage ||
    conversation?.partnerLanguage ||
    "es") as LanguageCode;
  const roomCode = params.roomCode || conversation?.roomCode || "";

  // Animation values
  const micScale = useSharedValue(1);
  const micPulse = useSharedValue(0);
  const micRingScale = useSharedValue(1);

  // ─────────────────────────────────────────────────────────────────────────────
  // ANIMATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isListening) {
      // Pulsing ring
      micPulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      // Expanding ring
      micRingScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 }),
        ),
        -1,
        false,
      );
    } else {
      micPulse.value = withTiming(0, { duration: 200 });
      micRingScale.value = withTiming(1, { duration: 200 });
    }
  }, [isListening]);

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const micPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      micPulse.value,
      [0, 0.5, 1],
      [0.6, 0.3, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ scale: micRingScale.value }],
  }));

  // ─────────────────────────────────────────────────────────────────────────────
  // REALTIME SERVICE
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomCode) {
      setError("No room code provided");
      return;
    }

    // Create realtime service
    const realtimeService = createRealtimeService({
      onMessage: handleRealtimeMessage,
      onPresenceJoin: (userId, language) => {
        console.log("[Conversation] Partner joined:", userId, language);
        setConnectionStatus("connected");
        triggerNotification(Haptics.NotificationFeedbackType.Success);
      },
      onPresenceLeave: (userId) => {
        console.log("[Conversation] Partner left:", userId);
        setConnectionStatus("disconnected");
        setPartnerStatus("idle");
      },
      onError: (err) => {
        console.error("[Conversation] Realtime error:", err);
        setError(err.message);
      },
      onConnected: () => {
        console.log("[Conversation] Connected to room:", roomCode);
        setConnectionStatus("connected");
      },
      onDisconnected: () => {
        console.log("[Conversation] Disconnected");
        setConnectionStatus("disconnected");
      },
    });

    // Join the room
    realtimeService.joinRoom(roomCode, myPresence.sessionId, myLanguage);

    // Initialize conversation state
    setConversation({
      roomCode,
      partnerId: "",
      partnerLanguage,
      connectionStatus: "connecting",
      isListening: false,
      isSpeaking: false,
      messages: [],
      myLiveText: "",
      myLiveTranslation: "",
      partnerLiveText: "",
      partnerLiveTranslation: "",
    });

    return () => {
      destroyRealtimeService();
    };
  }, [roomCode, myPresence.sessionId, myLanguage, partnerLanguage]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SPEECH RECOGNITION SERVICE
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Create speech recognition service
    speechServiceRef.current = createSpeechRecognitionService({
      onInterimResult: handleInterimResult,
      onFinalResult: handleFinalResult,
      onStart: () => {
        setIsListening(true);
        // Notify partner we're listening
        import("../lib/realtime").then(({ getRealtimeService }) => {
          getRealtimeService()?.sendStatus("listening");
        });
      },
      onEnd: () => {
        setIsListening(false);
        // Notify partner we stopped
        import("../lib/realtime").then(({ getRealtimeService }) => {
          getRealtimeService()?.sendStatus("idle");
        });
      },
      onError: (err) => {
        console.error("[Conversation] Speech error:", err);
        setIsListening(false);
        setError(err);
      },
    });

    return () => {
      destroySpeechRecognitionService();
    };
  }, []);

  // Hook into speech recognition events
  useSpeechRecognition(speechServiceRef.current);

  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleRealtimeMessage = useCallback(
    (message: RealtimeMessage) => {
      switch (message.type) {
        case "speech": {
          const payload = message.payload as SpeechPayload;

          if (payload.isInterim) {
            // Show interim results in partner section
            setPartnerLiveText(payload.originalText);
            setPartnerLiveTranslation(payload.translatedText);
          } else {
            // Final result - add to messages
            const newMessage: ConversationMessage = {
              id: `msg-${Date.now()}`,
              speaker: "partner",
              originalText: payload.originalText,
              translatedText: payload.translatedText,
              sourceLang: payload.sourceLang,
              targetLang: payload.targetLang,
              timestamp: message.timestamp,
            };
            setMessages((prev) => [...prev, newMessage]);
            setPartnerLiveText("");
            setPartnerLiveTranslation("");

            // Haptic feedback for new message
            triggerNotification(Haptics.NotificationFeedbackType.Success);
          }
          break;
        }

        case "status": {
          const payload = message.payload as StatusPayload;
          setPartnerStatus(
            payload.status === "reconnecting" ? "idle" : payload.status,
          );
          break;
        }

        case "end": {
          const payload = message.payload as EndPayload;
          console.log("[Conversation] Partner ended:", payload.reason);
          setConnectionStatus("disconnected");
          Alert.alert(
            "Conversation Ended",
            "Your partner has ended the conversation.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          break;
        }
      }
    },
    [router],
  );

  const handleInterimResult = useCallback(
    async (text: string) => {
      setMyLiveText(text);

      // Translate interim result (debounced)
      if (!isTranslatingRef.current && text.length > 3) {
        isTranslatingRef.current = true;

        try {
          const result = await translate(text, myLanguage, partnerLanguage);
          if (result.success) {
            setMyLiveTranslation(result.translatedText);

            // Send to partner
            const { getRealtimeService } = await import("../lib/realtime");
            getRealtimeService()?.sendSpeech(
              text,
              result.translatedText,
              partnerLanguage,
              true, // interim
            );
          }
        } catch (err) {
          console.error("[Conversation] Interim translation error:", err);
        }

        // Debounce
        setTimeout(() => {
          isTranslatingRef.current = false;
        }, 300);
      }
    },
    [myLanguage, partnerLanguage],
  );

  const handleFinalResult = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setMyLiveText("");
        setMyLiveTranslation("");
        return;
      }

      try {
        // Translate final result
        const result = await translate(text, myLanguage, partnerLanguage);

        // Add to local messages
        const newMessage: ConversationMessage = {
          id: `msg-${Date.now()}`,
          speaker: "me",
          originalText: text,
          translatedText: result.translatedText,
          sourceLang: myLanguage,
          targetLang: partnerLanguage,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, newMessage]);

        // Send final to partner
        const { getRealtimeService } = await import("../lib/realtime");
        getRealtimeService()?.sendSpeech(
          text,
          result.translatedText,
          partnerLanguage,
          false, // final
        );

        // Clear live text
        setMyLiveText("");
        setMyLiveTranslation("");

        // Haptic feedback
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      } catch (err) {
        console.error("[Conversation] Final translation error:", err);
      }
    },
    [myLanguage, partnerLanguage],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // USER ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleListening = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    if (isListening) {
      await speechServiceRef.current?.stop();
    } else {
      await speechServiceRef.current?.start({
        language: myLanguage,
        interimResults: true,
        addsPunctuation: true,
      });
    }
  }, [isListening, myLanguage]);

  const handleEndCall = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      "End Conversation?",
      "Are you sure you want to end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            // Stop listening if active
            if (isListening) {
              await speechServiceRef.current?.stop();
            }

            // Send end message
            const { getRealtimeService } = await import("../lib/realtime");
            await getRealtimeService()?.sendEndMessage("user_ended");

            // Clean up
            destroyRealtimeService();
            destroySpeechRecognitionService();
            endConversation();

            router.back();
          },
        },
      ],
    );
  }, [isListening, endConversation, router]);

  const handleShareLink = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const shareUrl = `entrevoz://join/${roomCode}`;
    const shareMessage = `Join my Entrevoz conversation!\n\nRoom Code: ${roomCode}\n\nOpen in app: ${shareUrl}`;

    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(roomCode);
        Alert.alert("Copied!", `Room code "${roomCode}" copied to clipboard`);
      } else {
        await Share.share({
          message: shareMessage,
          title: "Join Entrevoz Conversation",
        });
      }
    } catch (err) {
      console.error("[Conversation] Share error:", err);
      // Fallback to clipboard
      await Clipboard.setStringAsync(roomCode);
      Alert.alert("Copied!", `Room code "${roomCode}" copied to clipboard`);
    }
  }, [roomCode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const myLang = LANGUAGES.find((l) => l.code === myLanguage);
  const partnerLang = LANGUAGES.find((l) => l.code === partnerLanguage);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ConnectionBadge status={connectionStatus} />

        <View style={styles.headerCenter}>
          <Text style={styles.roomCode}>{roomCode}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareLink}
            accessibilityRole="button"
            accessibilityLabel="Share room link"
          >
            <Text style={styles.shareIcon}>🔗</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endButton}
            onPress={handleEndCall}
            accessibilityRole="button"
            accessibilityLabel="End conversation"
          >
            <Text style={styles.endIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => setError(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
          >
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Conversation Area */}
      <View style={styles.conversationContainer}>
        {/* Partner's Section (Top Half) */}
        <View style={[styles.section, styles.partnerSection]}>
          <LanguageHeader
            language={partnerLang}
            isPartner={true}
            isActive={
              partnerStatus === "speaking" || partnerStatus === "listening"
            }
            statusText={
              partnerStatus === "speaking"
                ? "Speaking"
                : partnerStatus === "listening"
                  ? "Listening"
                  : undefined
            }
          />

          <SpeechDisplay
            originalText={partnerLiveText}
            translatedText={partnerLiveTranslation}
            isLive={!!partnerLiveText}
            isPartner={true}
            placeholder={
              connectionStatus === "connected"
                ? "Partner's speech will appear here..."
                : "Waiting for partner to connect..."
            }
          />
        </View>

        {/* Divider with Language Indicators */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <View style={styles.languageIndicator}>
            <Text style={styles.langFlag}>{partnerLang?.flag}</Text>
            <Text style={styles.arrow}>⟷</Text>
            <Text style={styles.langFlag}>{myLang?.flag}</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        {/* My Section (Bottom Half) */}
        <View style={[styles.section, styles.mySection]}>
          <LanguageHeader
            language={myLang}
            isPartner={false}
            isActive={isListening}
            statusText={isListening ? "Recording" : undefined}
          />

          <SpeechDisplay
            originalText={myLiveText}
            translatedText={myLiveTranslation}
            isLive={isListening}
            isPartner={false}
            placeholder={
              isListening
                ? "Listening for your voice..."
                : "Tap the microphone to speak"
            }
          />
        </View>
      </View>

      {/* Microphone Button */}
      <View style={styles.micContainer}>
        {/* Pulse rings */}
        <Animated.View
          style={[
            styles.micPulseRing,
            { borderColor: COLORS.accent },
            micPulseStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.micPulseRing,
            styles.micPulseRing2,
            { borderColor: COLORS.accent },
            micPulseStyle,
          ]}
        />

        <Pressable
          onPressIn={() => {
            micScale.value = withSpring(0.92);
          }}
          onPressOut={() => {
            micScale.value = withSpring(1);
          }}
          onPress={toggleListening}
          disabled={connectionStatus !== "connected"}
          accessibilityRole="button"
          accessibilityLabel={
            isListening ? "Stop recording" : "Start recording"
          }
          accessibilityState={{ disabled: connectionStatus !== "connected" }}
        >
          <Animated.View
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
              connectionStatus !== "connected" && styles.micButtonDisabled,
              micStyle,
            ]}
          >
            {connectionStatus === "connecting" ? (
              <ActivityIndicator color={COLORS.textMuted} size="large" />
            ) : (
              <Text style={styles.micIcon}>{isListening ? "⏹" : "🎤"}</Text>
            )}
          </Animated.View>
        </Pressable>

        <Text style={styles.micHint}>
          {connectionStatus !== "connected"
            ? "Waiting for connection..."
            : isListening
              ? "Tap to stop"
              : "Tap to speak"}
        </Text>
      </View>

      {/* History Toggle */}
      {messages.length > 0 && (
        <TouchableOpacity
          style={styles.historyToggle}
          onPress={() => setShowHistory(!showHistory)}
          accessibilityRole="button"
          accessibilityLabel={
            showHistory ? "Hide message history" : "Show message history"
          }
        >
          <Text style={styles.historyLabel}>
            {showHistory ? "Hide History" : `View History (${messages.length})`}
          </Text>
          <Text style={styles.historyChevron}>{showHistory ? "▼" : "▲"}</Text>
        </TouchableOpacity>
      )}

      {/* Message History */}
      {showHistory && messages.length > 0 && (
        <View style={styles.historyContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.historyScroll}
            contentContainerStyle={styles.historyContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                isPartner={msg.speaker === "partner"}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCenter: {
    alignItems: "center",
  },
  roomCode: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareIcon: {
    fontSize: 18,
  },
  endButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.dangerDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  endIcon: {
    fontSize: 16,
    color: COLORS.danger,
    fontWeight: "bold",
  },
  errorBanner: {
    backgroundColor: COLORS.dangerDim,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    flex: 1,
  },
  errorDismiss: {
    color: COLORS.danger,
    fontSize: 16,
    paddingLeft: 12,
    fontWeight: "bold",
  },
  conversationContainer: {
    flex: 1,
  },
  section: {
    flex: 1,
    justifyContent: "center",
  },
  partnerSection: {
    borderBottomWidth: 0,
  },
  mySection: {
    borderTopWidth: 0,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  languageIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langFlag: {
    fontSize: 20,
  },
  arrow: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  micContainer: {
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 28,
  },
  micPulseRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  micPulseRing2: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
    shadowColor: COLORS.danger,
  },
  micButtonDisabled: {
    opacity: 0.5,
    borderColor: COLORS.border,
    shadowOpacity: 0,
  },
  micIcon: {
    fontSize: 32,
  },
  micHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  historyChevron: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  historyContainer: {
    maxHeight: height * 0.3,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyScroll: {
    flex: 1,
  },
  historyContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
