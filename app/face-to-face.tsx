/**
 * face-to-face.tsx — Face-to-Face Translation Screen
 *
 * Universal translator via shareable link.
 * Send a link, they open it, instant translation.
 *
 * Features:
 * - No app download required for partner
 * - Works anywhere in the world
 * - 30+ languages supported
 * - Real-time voice translation
 *
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  Share,
  Clipboard,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LANGUAGES, type LanguageCode } from "../constants/ble";
import {
  generateRoomCode,
  shareConversationLink,
  getShareableUrl,
} from "../lib/link-generator";
import { useProximityStore } from "../stores/proximityStore";

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE PICKER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function LanguagePicker({
  selected,
  onSelect,
  label,
}: {
  selected: LanguageCode;
  onSelect: (lang: LanguageCode) => void;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedLang = LANGUAGES.find((l) => l.code === selected) || LANGUAGES[0];

  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setExpanded(!expanded)}
        accessibilityLabel={`Select ${label}`}
        accessibilityRole="button"
      >
        <Text style={styles.pickerFlag}>{selectedLang.flag}</Text>
        <Text style={styles.pickerText}>{selectedLang.name}</Text>
        <Text style={styles.pickerArrow}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {expanded && (
        <ScrollView
          style={styles.pickerDropdown}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.pickerOption,
                lang.code === selected && styles.pickerOptionActive,
              ]}
              onPress={() => {
                onSelect(lang.code);
                setExpanded(false);
              }}
            >
              <Text style={styles.optionFlag}>{lang.flag}</Text>
              <Text
                style={[
                  styles.optionText,
                  lang.code === selected && styles.optionTextActive,
                ]}
              >
                {lang.name}
              </Text>
              <Text style={styles.optionNative}>{lang.nativeName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function FaceToFaceScreen() {
  const router = useRouter();
  const { myPresence, initialize, updateMyLanguage } = useProximityStore();
  const [partnerLang, setPartnerLang] = useState<LanguageCode>("es");
  const [isSharing, setIsSharing] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Initialize store on mount
  useEffect(() => {
    if (!myPresence.sessionId) {
      initialize();
    }
  }, [myPresence.sessionId, initialize]);

  // Handle share link action
  const handleCreateLink = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const code = generateRoomCode();
      const myLanguage = myPresence.language || "en";
      const url = getShareableUrl(code, myLanguage);

      setRoomCode(code);
      setGeneratedLink(url);

      // Share the link
      const result = await shareConversationLink(code, myLanguage);

      if (result.success) {
        if (result.action === "shared" || result.action === "copied") {
          Alert.alert(
            "Link Shared!",
            "When they open the link, come back here and tap 'Join Conversation'",
            [{ text: "Got it" }]
          );
        }
      }
    } catch (error) {
      console.error("[FaceToFace] Share error:", error);
      Alert.alert("Error", "Failed to create shareable link");
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, myPresence.language]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(() => {
    if (generatedLink) {
      Clipboard.setString(generatedLink);
      Alert.alert("Copied!", "Link copied to clipboard");
    }
  }, [generatedLink]);

  // Join conversation with generated room code
  const handleJoinConversation = useCallback(() => {
    if (roomCode) {
      router.push({
        pathname: "/conversation",
        params: {
          roomCode,
          partnerLanguage: partnerLang,
        },
      });
    }
  }, [roomCode, partnerLang, router]);

  // Navigate to nearby radar
  const handleFindNearby = useCallback(() => {
    router.push("/radar");
  }, [router]);

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
            <Text style={styles.title}>Face-to-Face</Text>
            <Text style={styles.subtitle}>Universal translator</Text>
          </View>
        </View>

        {/* Hero Icon */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🌍</Text>
          </View>
          <Text style={styles.heroTitle}>Link Mode</Text>
          <Text style={styles.heroTagline}>
            Send a link. They open it. Instant translation.
          </Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresBox}>
          {[
            "No app download required",
            "Works anywhere in the world",
            "30+ languages supported",
            "Real-time voice translation",
          ].map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Language Selection */}
        <View style={styles.languageSection}>
          <LanguagePicker
            selected={myPresence.language || "en"}
            onSelect={updateMyLanguage}
            label="I speak"
          />
          <View style={styles.languageDivider}>
            <Text style={styles.dividerArrow}>↔</Text>
          </View>
          <LanguagePicker
            selected={partnerLang}
            onSelect={setPartnerLang}
            label="They speak"
          />
        </View>

        {/* Generated Link Display */}
        {generatedLink && (
          <View style={styles.linkBox}>
            <Text style={styles.linkLabel}>Your conversation link:</Text>
            <Text style={styles.linkText} numberOfLines={2}>
              {generatedLink}
            </Text>
            <View style={styles.linkActions}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyLink}
              >
                <Text style={styles.copyButtonText}>📋 Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.joinButton}
                onPress={handleJoinConversation}
              >
                <Text style={styles.joinButtonText}>Join Conversation →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, isSharing && styles.buttonDisabled]}
          onPress={handleCreateLink}
          disabled={isSharing}
          accessibilityLabel="Create and share link"
          accessibilityRole="button"
        >
          {isSharing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {generatedLink ? "Share New Link" : "Share Link"}
              </Text>
              <Text style={styles.primaryButtonIcon}>🔗</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Secondary CTA */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleFindNearby}
          accessibilityLabel="Find someone nearby via Bluetooth"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Find Nearby</Text>
          <Text style={styles.secondaryButtonIcon}>📡</Text>
        </TouchableOpacity>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How it works</Text>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Tap "Share Link" to create a unique conversation link
            </Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Send the link to someone via WhatsApp, text, or any app
            </Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              When they open it, you both get real-time voice translation
            </Text>
          </View>
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
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(129,140,248,0.15)",
    borderWidth: 2,
    borderColor: "#818CF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTagline: {
    color: "#818CF8",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },

  // Features
  featuresBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#818CF8",
  },
  featureText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Language Selection
  languageSection: {
    marginBottom: 24,
  },
  pickerContainer: {
    marginBottom: 12,
  },
  pickerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  pickerFlag: {
    fontSize: 24,
  },
  pickerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  pickerArrow: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  pickerDropdown: {
    backgroundColor: "rgba(10,14,20,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  pickerOptionActive: {
    backgroundColor: "rgba(129,140,248,0.15)",
  },
  optionFlag: {
    fontSize: 20,
  },
  optionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  optionTextActive: {
    color: "#818CF8",
  },
  optionNative: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  languageDivider: {
    alignItems: "center",
    marginVertical: 4,
  },
  dividerArrow: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 20,
  },

  // Generated Link
  linkBox: {
    backgroundColor: "rgba(129,140,248,0.1)",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.3)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  linkLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  linkText: {
    color: "#818CF8",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 12,
  },
  linkActions: {
    flexDirection: "row",
    gap: 10,
  },
  copyButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  copyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  joinButton: {
    flex: 2,
    backgroundColor: "#818CF8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  joinButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },

  // Buttons
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#818CF8",
    borderRadius: 14,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButtonIcon: {
    fontSize: 18,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(129,140,248,0.4)",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 32,
  },
  secondaryButtonText: {
    color: "#818CF8",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButtonIcon: {
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Info Section
  infoSection: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  infoStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(129,140,248,0.15)",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#818CF8",
    fontSize: 13,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    lineHeight: 20,
  },
});
