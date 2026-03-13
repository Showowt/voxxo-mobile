/**
 * call-wingman.tsx — Call Wingman Screen
 *
 * The UI for Call Wingman. Two states:
 *
 * 1. STANDBY — Waiting for a call or call detected, not yet activated
 *    - Shows mode selector (Date / Interview / Sales / Hard Talk)
 *    - Output mode toggle (Ear / Screen / Both)
 *    - "Activate Wingman" button
 *
 * 2. ACTIVE — Wingman is running
 *    - Live transcript of what they're saying
 *    - 3 suggestion cards: Bold / Warm / Safe
 *    - Tap any to speak it via AirPods
 *    - Auto-speaks Warm by default
 *    - Pulsing indicator when AI is thinking
 *
 * @version 2.0.0
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  useCallWingman,
  formatDuration,
  type WingmanMode,
  type OutputMode,
} from "@/hooks/useCallWingman";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Mode config ───────────────────────────────────────────────────────────────
const MODES: { id: WingmanMode; label: string; emoji: string; hint: string }[] =
  [
    {
      id: "date",
      label: "Date",
      emoji: "💕",
      hint: "Charming, confident, playful",
    },
    {
      id: "interview",
      label: "Interview",
      emoji: "🎯",
      hint: "Sharp, specific, memorable",
    },
    {
      id: "sales",
      label: "Sales",
      emoji: "🤝",
      hint: "Value-led, objection-ready",
    },
    {
      id: "hardtalk",
      label: "Hard Talk",
      emoji: "🧠",
      hint: "Clear, calm, de-escalating",
    },
  ];

// ── Suggestion card ───────────────────────────────────────────────────────────
function SuggestionCard({
  text,
  label,
  emoji,
  color,
  onPress,
  isLastSpoken,
  disabled,
}: {
  text: string;
  label: string;
  emoji: string;
  color: string;
  onPress: () => void;
  isLastSpoken: boolean;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled || !text) return;
    scale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withTiming(1.0, { duration: 120 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[
          styles.suggestionCard,
          isLastSpoken && styles.suggestionCardActive,
          !text && styles.suggestionCardEmpty,
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled || !text}
        accessibilityLabel={`${label} suggestion: ${text || "Loading"}`}
        accessibilityRole="button"
        accessibilityHint="Tap to speak this suggestion"
      >
        <View style={styles.suggestionHeader}>
          <View style={[styles.toneBadge, { backgroundColor: color + "22" }]}>
            <Text style={styles.toneEmoji}>{emoji}</Text>
            <Text style={[styles.toneLabel, { color }]}>{label}</Text>
          </View>
          {isLastSpoken && <Text style={styles.spokenBadge}>Speaking...</Text>}
        </View>
        <Text
          style={[styles.suggestionText, !text && styles.suggestionTextEmpty]}
          numberOfLines={4}
        >
          {text || "Waiting for suggestion..."}
        </Text>
        {text && <Text style={styles.tapHint}>Tap to speak</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Pulse indicator ───────────────────────────────────────────────────────────
function PulseIndicator({ active }: { active: boolean }) {
  const opacity = useSharedValue(0.4);

  React.useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = 0.4;
    }
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.pulseRing, style]}>
      <View style={[styles.pulseCore, active && styles.pulseCoreActive]} />
    </Animated.View>
  );
}

// ── Loading Shimmer ───────────────────────────────────────────────────────────
function ThinkingIndicator() {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.thinkingContainer, style]}>
      <Text style={styles.thinkingEmoji}>🧠</Text>
      <Text style={styles.thinkingText}>Analyzing conversation...</Text>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CallWingmanScreen() {
  const w = useCallWingman();
  const [speakerReminder, setSpeakerReminder] = useState(false);

  const handleActivate = async () => {
    setSpeakerReminder(true);
    setTimeout(() => setSpeakerReminder(false), 5000);
    await w.activate();
  };

  const SUGGESTIONS = [
    {
      tone: "bold",
      label: "Bold",
      emoji: "⚡",
      color: "#f97316",
      text: w.suggestion?.bold ?? "",
    },
    {
      tone: "warm",
      label: "Warm",
      emoji: "💛",
      color: "#00E5A0",
      text: w.suggestion?.warm ?? "",
    },
    {
      tone: "safe",
      label: "Safe",
      emoji: "🛡️",
      color: "#818cf8",
      text: w.suggestion?.safe ?? "",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Call Wingman</Text>
          <Text style={styles.subtitle}>
            {w.isCapturing
              ? `Active · ${formatDuration(w.callDurationSec)}`
              : w.isCallActive
                ? "Call detected"
                : "Make a call first"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {w.isCapturing && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {w.isCapturing && (
            <TouchableOpacity
              style={styles.stopButton}
              onPress={w.deactivate}
              accessibilityLabel="Stop Wingman"
              accessibilityRole="button"
            >
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── STANDBY STATE ── */}
        {!w.isCapturing && (
          <>
            {/* No call active prompt */}
            {!w.isCallActive && (
              <View style={styles.noCallBox}>
                <Text style={styles.noCallEmoji}>📞</Text>
                <Text style={styles.noCallTitle}>Start a phone call</Text>
                <Text style={styles.noCallSubtitle}>
                  Call Wingman listens to your conversation and suggests what to
                  say in real-time.
                </Text>
              </View>
            )}

            {/* Mode selector */}
            <Text style={styles.sectionLabel}>Conversation Mode</Text>
            <View style={styles.modeGrid}>
              {MODES.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.modeCard,
                    w.mode === m.id && styles.modeCardActive,
                  ]}
                  onPress={() => w.setMode(m.id)}
                  accessibilityLabel={`${m.label} mode: ${m.hint}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: w.mode === m.id }}
                >
                  <Text style={styles.modeEmoji}>{m.emoji}</Text>
                  <Text
                    style={[
                      styles.modeLabel,
                      w.mode === m.id && styles.modeLabelActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                  <Text style={styles.modeHint}>{m.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Output mode */}
            <Text style={styles.sectionLabel}>Output Mode</Text>
            <View style={styles.outputRow}>
              {(
                [
                  {
                    id: "ear",
                    icon: "🎧",
                    label: "Ear only",
                    desc: "Spoken via AirPods",
                  },
                  {
                    id: "both",
                    icon: "🎧📱",
                    label: "Both",
                    desc: "Spoken + shown",
                  },
                  {
                    id: "screen",
                    icon: "📱",
                    label: "Screen only",
                    desc: "Silent display",
                  },
                ] as {
                  id: OutputMode;
                  icon: string;
                  label: string;
                  desc: string;
                }[]
              ).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[
                    styles.outputOption,
                    w.outputMode === o.id && styles.outputOptionActive,
                  ]}
                  onPress={() => w.setOutputMode(o.id)}
                  accessibilityLabel={`${o.label}: ${o.desc}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: w.outputMode === o.id }}
                >
                  <Text style={styles.outputIcon}>{o.icon}</Text>
                  <View style={styles.outputTextWrap}>
                    <Text style={styles.outputLabel}>{o.label}</Text>
                    <Text style={styles.outputDesc}>{o.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Auto-speak toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>
                  Auto-speak warm suggestion
                </Text>
                <Text style={styles.toggleDesc}>
                  Wingman speaks automatically when they pause
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, w.autoSpeak && styles.toggleActive]}
                onPress={() => w.setAutoSpeak(!w.autoSpeak)}
                accessibilityLabel="Auto-speak warm suggestion"
                accessibilityRole="switch"
                accessibilityState={{ checked: w.autoSpeak }}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    w.autoSpeak && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>

            {/* Speaker reminder */}
            {speakerReminder && (
              <View style={styles.reminder}>
                <Text style={styles.reminderEmoji}>🔊</Text>
                <Text style={styles.reminderText}>
                  Put your call on speaker so Wingman can hear the other person
                </Text>
              </View>
            )}

            {/* Error display */}
            {w.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {w.error}</Text>
              </View>
            )}

            {/* Activate button */}
            <TouchableOpacity
              style={[
                styles.activateButton,
                !w.isCallActive && styles.activateButtonDimmed,
              ]}
              onPress={handleActivate}
              disabled={!w.isCallActive}
              accessibilityLabel={
                w.isCallActive ? "Activate Wingman" : "Start a call first"
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: !w.isCallActive }}
            >
              <Text style={styles.activateEmoji}>
                {w.isCallActive ? "🎯" : "📞"}
              </Text>
              <Text style={styles.activateText}>
                {w.isCallActive ? "Activate Wingman" : "Start a call first"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ACTIVE STATE ── */}
        {w.isCapturing && (
          <>
            {/* Live transcript */}
            <View style={styles.transcriptBox}>
              <View style={styles.transcriptHeader}>
                <PulseIndicator active={!!w.liveTranscript || w.isLoading} />
                <Text style={styles.transcriptHeaderText}>
                  {w.isLoading
                    ? "Thinking..."
                    : w.liveTranscript
                      ? "Listening..."
                      : "Waiting for them to speak"}
                </Text>
                {w.isLoading && (
                  <ActivityIndicator size="small" color="#00E5A0" />
                )}
              </View>
              <Text style={styles.liveTranscript} numberOfLines={3}>
                {w.liveTranscript ||
                  (w.transcriptLog.length > 0
                    ? `"${w.transcriptLog[w.transcriptLog.length - 1].text}"`
                    : "Listening for the other person...")}
              </Text>
            </View>

            {/* Thinking indicator */}
            {w.isLoading && !w.suggestion && <ThinkingIndicator />}

            {/* Suggestions */}
            {w.suggestion ? (
              <>
                <Text style={styles.sectionLabel}>What to say</Text>
                {SUGGESTIONS.map((s) => (
                  <SuggestionCard
                    key={s.tone}
                    label={s.label}
                    emoji={s.emoji}
                    color={s.color}
                    text={s.text}
                    onPress={() => w.speak(s.text)}
                    isLastSpoken={w.lastSpoken === s.text}
                    disabled={w.isLoading}
                  />
                ))}
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={w.clearTranscript}
                  accessibilityLabel="Clear conversation and get fresh suggestions"
                  accessibilityRole="button"
                >
                  <Text style={styles.clearButtonText}>
                    Clear and get fresh suggestions
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              !w.isLoading && (
                <View style={styles.waitingContainer}>
                  <Text style={styles.waitingEmoji}>🎧</Text>
                  <Text style={styles.waitingText}>
                    Listening to the conversation...
                  </Text>
                  <Text style={styles.waitingHint}>
                    Suggestions appear when they speak.{"\n"}Make sure call is
                    on speaker.
                  </Text>
                </View>
              )
            )}

            {/* Transcript history */}
            {w.transcriptLog.length > 1 && (
              <>
                <Text style={styles.sectionLabel}>Conversation History</Text>
                <View style={styles.logBox}>
                  {w.transcriptLog.slice(-5).map((line) => (
                    <View key={line.id} style={styles.logLineWrap}>
                      <Text style={styles.logSpeaker}>Them:</Text>
                      <Text style={styles.logLine} numberOfLines={2}>
                        {line.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030507",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 16 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  liveText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stopButton: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stopButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  noCallBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 8,
  },
  noCallEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noCallTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  noCallSubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modeCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
  },
  modeCardActive: {
    borderColor: "#00E5A0",
    backgroundColor: "rgba(0,229,160,0.08)",
  },
  modeEmoji: { fontSize: 24, marginBottom: 6 },
  modeLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  modeLabelActive: { color: "#00E5A0" },
  modeHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    lineHeight: 15,
  },
  outputRow: { gap: 8 },
  outputOption: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  outputOptionActive: {
    borderColor: "#00E5A0",
    backgroundColor: "rgba(0,229,160,0.08)",
  },
  outputIcon: {
    fontSize: 20,
  },
  outputTextWrap: {
    flex: 1,
  },
  outputLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  outputDesc: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginTop: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  toggleDesc: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleActive: { backgroundColor: "#00E5A0" },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  toggleThumbActive: {
    backgroundColor: "#fff",
    transform: [{ translateX: 20 }],
  },
  reminder: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reminderEmoji: {
    fontSize: 24,
  },
  reminderText: {
    color: "#f97316",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  activateButton: {
    backgroundColor: "#00E5A0",
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  activateButtonDimmed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  activateEmoji: {
    fontSize: 20,
  },
  activateText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  // Active state
  transcriptBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  transcriptHeaderText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  liveTranscript: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
  },
  pulseRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,160,0.2)",
  },
  pulseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  pulseCoreActive: { backgroundColor: "#00E5A0" },
  thinkingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
    backgroundColor: "rgba(0,229,160,0.05)",
    borderRadius: 12,
  },
  thinkingEmoji: {
    fontSize: 24,
  },
  thinkingText: {
    color: "#00E5A0",
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
  },
  suggestionCardActive: {
    borderColor: "rgba(0,229,160,0.4)",
    backgroundColor: "rgba(0,229,160,0.08)",
  },
  suggestionCardEmpty: {
    opacity: 0.5,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  toneBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  toneEmoji: {
    fontSize: 14,
  },
  toneLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  spokenBadge: {
    color: "#00E5A0",
    fontSize: 11,
    fontWeight: "600",
  },
  suggestionText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  suggestionTextEmpty: {
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
  },
  tapHint: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
  },
  clearButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  clearButtonText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    fontWeight: "500",
  },
  waitingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  waitingEmoji: { fontSize: 48 },
  waitingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  waitingHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  logBox: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  logLineWrap: {
    flexDirection: "row",
    gap: 6,
  },
  logSpeaker: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    fontWeight: "600",
  },
  logLine: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});
