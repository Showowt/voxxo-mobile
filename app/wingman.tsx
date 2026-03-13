/**
 * wingman.tsx — Wingman Entry Screen
 *
 * Landing screen for the Call Wingman feature.
 * AI whispers perfect responses in your ear during phone calls.
 *
 * This screen provides context and options before activating Wingman.
 *
 * @version 1.0.0
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE CARDS
// ═══════════════════════════════════════════════════════════════════════════════

const USE_CASES = [
  {
    emoji: "💼",
    title: "Sales Calls",
    description: "Close more deals with perfect objection handling",
    color: "#00E5A0",
  },
  {
    emoji: "🎯",
    title: "Job Interviews",
    description: "Nail every question with confident answers",
    color: "#818CF8",
  },
  {
    emoji: "💕",
    title: "First Dates",
    description: "Always charming, never awkward",
    color: "#F472B6",
  },
  {
    emoji: "🧠",
    title: "Hard Talks",
    description: "Stay calm and clear under pressure",
    color: "#FBBF24",
  },
];

function UseCaseCard({
  emoji,
  title,
  description,
  color,
}: (typeof USE_CASES)[0]) {
  return (
    <View style={[styles.useCaseCard, { borderColor: color + "40" }]}>
      <View style={[styles.useCaseIcon, { backgroundColor: color + "20" }]}>
        <Text style={styles.useCaseEmoji}>{emoji}</Text>
      </View>
      <View style={styles.useCaseContent}>
        <Text style={styles.useCaseTitle}>{title}</Text>
        <Text style={styles.useCaseDescription}>{description}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function WingmanScreen() {
  const router = useRouter();

  const handleStartWingman = () => {
    router.push("/call-wingman");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Call Wingman</Text>
            <Text style={styles.subtitle}>Your AI-powered conversation coach</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>📞</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>AI</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Never stumble on a call again</Text>
          <Text style={styles.heroTagline}>
            AI whispers perfect responses in your ear during phone calls
          </Text>
        </View>

        {/* Value Prop */}
        <View style={styles.valueBox}>
          <Text style={styles.valueEmoji}>🎧</Text>
          <Text style={styles.valueText}>
            Works with AirPods or any Bluetooth headset. The other person won't hear a thing.
          </Text>
        </View>

        {/* Use Cases */}
        <Text style={styles.sectionTitle}>PERFECT FOR</Text>
        <View style={styles.useCasesGrid}>
          {USE_CASES.map((useCase, index) => (
            <UseCaseCard key={index} {...useCase} />
          ))}
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
        <View style={styles.howItWorks}>
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <Text style={styles.howStepNumberText}>1</Text>
            </View>
            <View style={styles.howStepContent}>
              <Text style={styles.howStepTitle}>Start a phone call</Text>
              <Text style={styles.howStepDesc}>
                Make or receive a call, then put it on speaker
              </Text>
            </View>
          </View>
          <View style={styles.howStepConnector} />
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <Text style={styles.howStepNumberText}>2</Text>
            </View>
            <View style={styles.howStepContent}>
              <Text style={styles.howStepTitle}>Activate Wingman</Text>
              <Text style={styles.howStepDesc}>
                Choose your mode (Sales, Interview, Date, Hard Talk)
              </Text>
            </View>
          </View>
          <View style={styles.howStepConnector} />
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <Text style={styles.howStepNumberText}>3</Text>
            </View>
            <View style={styles.howStepContent}>
              <Text style={styles.howStepTitle}>Get suggestions</Text>
              <Text style={styles.howStepDesc}>
                AI listens and whispers perfect responses in your ear
              </Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartWingman}
          accessibilityLabel="Start Call Wingman"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonEmoji}>🎯</Text>
          <Text style={styles.primaryButtonText}>Start Wingman</Text>
          <Text style={styles.primaryButtonArrow}>→</Text>
        </TouchableOpacity>

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Requires AirPods or Bluetooth headset for private coaching.
            Works best with calls on speaker.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030507",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: Platform.OS === "android" ? 16 : 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  backArrow: {
    color: "#fff",
    fontSize: 20,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    marginTop: 2,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  heroIcon: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: "rgba(0,229,160,0.15)",
    borderWidth: 2,
    borderColor: "#00E5A0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  heroEmoji: {
    fontSize: 40,
  },
  heroBadge: {
    position: "absolute",
    bottom: -8,
    right: -8,
    backgroundColor: "#00E5A0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroBadgeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  heroTagline: {
    color: "#00E5A0",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },

  // Value Box
  valueBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 28,
  },
  valueEmoji: {
    fontSize: 28,
  },
  valueText: {
    flex: 1,
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    lineHeight: 19,
  },

  // Section Title
  sectionTitle: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  // Use Cases
  useCasesGrid: {
    gap: 10,
    marginBottom: 28,
  },
  useCaseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  useCaseIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  useCaseEmoji: {
    fontSize: 24,
  },
  useCaseContent: {
    flex: 1,
  },
  useCaseTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  useCaseDescription: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },

  // How it works
  howItWorks: {
    marginBottom: 28,
  },
  howStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  howStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,229,160,0.15)",
    borderWidth: 1,
    borderColor: "rgba(0,229,160,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  howStepNumberText: {
    color: "#00E5A0",
    fontSize: 14,
    fontWeight: "700",
  },
  howStepContent: {
    flex: 1,
    paddingTop: 2,
  },
  howStepTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  howStepDesc: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    lineHeight: 18,
  },
  howStepConnector: {
    width: 2,
    height: 24,
    backgroundColor: "rgba(0,229,160,0.2)",
    marginLeft: 15,
    marginVertical: 4,
  },

  // Primary Button
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00E5A0",
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 16,
  },
  primaryButtonEmoji: {
    fontSize: 20,
  },
  primaryButtonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
  },
  primaryButtonArrow: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
  },

  // Footer Note
  footerNote: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  footerNoteText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
