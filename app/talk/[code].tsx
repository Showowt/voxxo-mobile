/**
 * Entrevoz Talk Join Screen
 *
 * Dynamic route for joining a conversation via shareable link.
 * URL format: entrevoz.co/talk/ABC123?lang=en
 *
 * @version 1.0.0
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

import { LANGUAGES, type LanguageCode } from "../../constants/ble";
import { useProximityStore } from "../../stores/proximityStore";
import { isValidRoomCode, normalizeRoomCode } from "../../lib/link-generator";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TalkJoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; lang?: string }>();
  const { myPresence, initialize } = useProximityStore();

  // State
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    myPresence.language || "en",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostLanguage, setHostLanguage] = useState<LanguageCode | null>(null);

  // Extract and validate room code
  const roomCode = params.code ? normalizeRoomCode(params.code) : "";
  const isValid = isValidRoomCode(roomCode);

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      // Initialize store if needed
      if (!myPresence.sessionId) {
        await initialize();
      }

      // Check if room code is valid
      if (!roomCode || !isValid) {
        setError("Invalid room code. Please check the link and try again.");
        setIsLoading(false);
        return;
      }

      // Extract host language from URL params
      if (params.lang && LANGUAGES.some((l) => l.code === params.lang)) {
        setHostLanguage(params.lang as LanguageCode);
      }

      setIsLoading(false);
    };

    init();
  }, [roomCode, isValid, params.lang, myPresence.sessionId, initialize]);

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleLanguageSelect = (code: LanguageCode) => {
    setSelectedLanguage(code);
  };

  const handleJoinConversation = () => {
    if (!isValid) {
      setError("Invalid room code");
      return;
    }

    // Update store with selected language
    useProximityStore.getState().updateMyLanguage(selectedLanguage);

    // Navigate to conversation with room code
    router.push({
      pathname: "/conversation",
      params: {
        roomCode: roomCode,
        partnerLanguage: hostLanguage || "en",
      },
    });
  };

  const handleCancel = () => {
    router.replace("/");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const selectedLang = LANGUAGES.find((l) => l.code === selectedLanguage);
  const hostLang = hostLanguage
    ? LANGUAGES.find((l) => l.code === hostLanguage)
    : null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00DBA8" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>!</Text>
          <Text style={styles.errorTitle}>Unable to Join</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable style={styles.errorButton} onPress={handleCancel}>
            <Text style={styles.errorButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Join Conversation</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Room Info */}
      <View style={styles.roomInfo}>
        <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
        <View style={styles.roomCodeContainer}>
          <Text style={styles.roomCode}>{roomCode}</Text>
        </View>
        {hostLang && (
          <Text style={styles.hostInfo}>
            {hostLang.flag} Host speaks {hostLang.name}
          </Text>
        )}
      </View>

      {/* Language Selection */}
      <View style={styles.languageSection}>
        <Text style={styles.sectionTitle}>SELECT YOUR LANGUAGE</Text>
        <Text style={styles.selectedLanguage}>
          {selectedLang?.flag} {selectedLang?.name}
        </Text>

        <ScrollView
          style={styles.languageList}
          contentContainerStyle={styles.languageListContent}
          showsVerticalScrollIndicator={false}
        >
          {LANGUAGES.map((lang) => {
            // Highlight if same as host language
            const isSameAsHost = hostLanguage && lang.code === hostLanguage;

            return (
              <Pressable
                key={lang.code}
                style={[
                  styles.languageItem,
                  selectedLanguage === lang.code && styles.languageItemSelected,
                  isSameAsHost && styles.languageItemHost,
                ]}
                onPress={() => handleLanguageSelect(lang.code as LanguageCode)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${lang.name} as your language`}
                accessibilityState={{
                  selected: selectedLanguage === lang.code,
                }}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <View style={styles.languageInfo}>
                  <Text style={styles.languageName}>{lang.name}</Text>
                  <Text style={styles.languageNative}>{lang.nativeName}</Text>
                </View>
                {selectedLanguage === lang.code && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}></Text>
                  </View>
                )}
                {isSameAsHost && selectedLanguage !== lang.code && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>HOST</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Join Button */}
      <View style={styles.footer}>
        <Pressable
          style={styles.joinButton}
          onPress={handleJoinConversation}
          accessibilityRole="button"
          accessibilityLabel={`Join conversation as ${selectedLang?.name} speaker`}
        >
          <Text style={styles.joinButtonText}>
            Join as {selectedLang?.name} Speaker
          </Text>
        </Pressable>

        <Text style={styles.footerText}>
          You will join a real-time translated conversation
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E14",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#71717a",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  errorEmoji: {
    fontSize: 64,
    color: "#ef4444",
    fontWeight: "700",
    width: 80,
    height: 80,
    textAlign: "center",
    lineHeight: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#ef4444",
    overflow: "hidden",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  errorMessage: {
    fontSize: 16,
    color: "#71717a",
    textAlign: "center",
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: "#00DBA8",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  cancelButton: {
    padding: 8,
    minWidth: 60,
  },
  cancelButtonText: {
    color: "#0088FF",
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  placeholder: {
    width: 60,
  },
  roomInfo: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  roomCodeLabel: {
    fontSize: 12,
    color: "#71717a",
    letterSpacing: 1,
    marginBottom: 8,
  },
  roomCodeContainer: {
    backgroundColor: "#1A1F2E",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#00DBA8",
  },
  roomCode: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  hostInfo: {
    marginTop: 12,
    fontSize: 14,
    color: "#71717a",
  },
  languageSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    color: "#71717a",
    marginBottom: 8,
    letterSpacing: 1,
  },
  selectedLanguage: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  languageList: {
    flex: 1,
  },
  languageListContent: {
    paddingBottom: 20,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1F2E",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
    cursor: "pointer" as unknown as undefined,
  },
  languageItemSelected: {
    borderColor: "#00DBA8",
    backgroundColor: "#0D2922",
  },
  languageItemHost: {
    borderColor: "#27272a",
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  languageNative: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00DBA8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  hostBadge: {
    backgroundColor: "#27272a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hostBadgeText: {
    color: "#71717a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  joinButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00DBA8",
    borderRadius: 14,
    paddingVertical: 18,
    cursor: "pointer" as unknown as undefined,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    color: "#52525b",
  },
});
