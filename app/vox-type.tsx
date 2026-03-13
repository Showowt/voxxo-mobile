/**
 * vox-type.tsx — VoxType Screen
 *
 * Text-based translation interface.
 * Type or paste text and get instant translations.
 *
 * Features:
 * - Instant text translation
 * - Auto-detect source language
 * - Copy translations to clipboard
 * - Text-to-speech playback
 * - Translation history
 *
 * @version 1.0.0
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { LANGUAGES, type LanguageCode, getLanguageByCode } from "../constants/ble";
import { translationService } from "../services/translation";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

function LanguageSelector({
  value,
  onChange,
  label,
}: {
  value: LanguageCode;
  onChange: (lang: LanguageCode) => void;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const lang = getLanguageByCode(value);

  return (
    <View style={styles.langSelector}>
      <Text style={styles.langLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.langButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.langFlag}>{lang.flag}</Text>
        <Text style={styles.langName}>{lang.name}</Text>
        <Text style={styles.langArrow}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {expanded && (
        <ScrollView
          style={styles.langDropdown}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[
                styles.langOption,
                l.code === value && styles.langOptionActive,
              ]}
              onPress={() => {
                onChange(l.code);
                setExpanded(false);
              }}
            >
              <Text style={styles.langOptionFlag}>{l.flag}</Text>
              <Text style={styles.langOptionName}>{l.name}</Text>
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

export default function VoxTypeScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState<LanguageCode>("en");
  const [targetLang, setTargetLang] = useState<LanguageCode>("es");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [history, setHistory] = useState<TranslationEntry[]>([]);

  // Swap languages
  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    // Also swap texts if translation exists
    if (translatedText && inputText) {
      setInputText(translatedText);
      setTranslatedText(inputText);
    }
  }, [sourceLang, targetLang, inputText, translatedText]);

  // Translate text
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim() || isTranslating) return;

    setIsTranslating(true);
    try {
      const result = await translationService.translate(
        inputText.trim(),
        sourceLang,
        targetLang
      );

      if (result.success) {
        setTranslatedText(result.translatedText);

        // Add to history
        const entry: TranslationEntry = {
          id: Date.now().toString(),
          originalText: inputText.trim(),
          translatedText: result.translatedText,
          sourceLang,
          targetLang,
          timestamp: Date.now(),
        };
        setHistory((prev) => [entry, ...prev.slice(0, 9)]);
      } else {
        Alert.alert("Translation Error", result.error || "Failed to translate");
      }
    } catch (error) {
      console.error("[VoxType] Translation error:", error);
      Alert.alert("Error", "Failed to translate text");
    } finally {
      setIsTranslating(false);
    }
  }, [inputText, sourceLang, targetLang, isTranslating]);

  // Copy to clipboard
  const handleCopy = useCallback((text: string) => {
    Clipboard.setString(text);
    Alert.alert("Copied!", "Text copied to clipboard");
  }, []);

  // Speak text
  const handleSpeak = useCallback(
    async (text: string, lang: LanguageCode) => {
      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      try {
        await Speech.speak(text, {
          language: lang,
          rate: 0.9,
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch (error) {
        setIsSpeaking(false);
      }
    },
    [isSpeaking]
  );

  // Clear all
  const handleClear = useCallback(() => {
    setInputText("");
    setTranslatedText("");
  }, []);

  // Load from history
  const handleLoadHistory = useCallback((entry: TranslationEntry) => {
    setInputText(entry.originalText);
    setTranslatedText(entry.translatedText);
    setSourceLang(entry.sourceLang);
    setTargetLang(entry.targetLang);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.title}>VoxType</Text>
            <Text style={styles.subtitle}>Text translation</Text>
          </View>
        </View>

        {/* Language Selection */}
        <View style={styles.languageRow}>
          <LanguageSelector
            value={sourceLang}
            onChange={setSourceLang}
            label="From"
          />
          <TouchableOpacity
            style={styles.swapButton}
            onPress={handleSwapLanguages}
            accessibilityLabel="Swap languages"
            accessibilityRole="button"
          >
            <Text style={styles.swapIcon}>⇄</Text>
          </TouchableOpacity>
          <LanguageSelector
            value={targetLang}
            onChange={setTargetLang}
            label="To"
          />
        </View>

        {/* Input Box */}
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="Type or paste text to translate..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {inputText.length > 0 && (
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={styles.inputAction}
                onPress={() => handleSpeak(inputText, sourceLang)}
              >
                <Text style={styles.inputActionIcon}>
                  {isSpeaking ? "⏹️" : "🔊"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inputAction}
                onPress={handleClear}
              >
                <Text style={styles.inputActionIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.charCount}>{inputText.length}/500</Text>
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[
            styles.translateButton,
            (!inputText.trim() || isTranslating) && styles.buttonDisabled,
          ]}
          onPress={handleTranslate}
          disabled={!inputText.trim() || isTranslating}
          accessibilityLabel="Translate text"
          accessibilityRole="button"
        >
          {isTranslating ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.translateButtonIcon}>🌐</Text>
              <Text style={styles.translateButtonText}>Translate</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Output Box */}
        {translatedText && (
          <View style={styles.outputBox}>
            <View style={styles.outputHeader}>
              <Text style={styles.outputLabel}>Translation</Text>
              <View style={styles.outputActions}>
                <TouchableOpacity
                  style={styles.outputAction}
                  onPress={() => handleSpeak(translatedText, targetLang)}
                >
                  <Text style={styles.outputActionText}>
                    {isSpeaking ? "⏹️" : "🔊"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.outputAction}
                  onPress={() => handleCopy(translatedText)}
                >
                  <Text style={styles.outputActionText}>📋</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.outputText}>{translatedText}</Text>
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Translations</Text>
            {history.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.historyItem}
                onPress={() => handleLoadHistory(entry)}
              >
                <View style={styles.historyLangs}>
                  <Text style={styles.historyLang}>
                    {getLanguageByCode(entry.sourceLang).flag}
                  </Text>
                  <Text style={styles.historyArrow}>→</Text>
                  <Text style={styles.historyLang}>
                    {getLanguageByCode(entry.targetLang).flag}
                  </Text>
                </View>
                <Text style={styles.historyText} numberOfLines={1}>
                  {entry.originalText}
                </Text>
                <Text style={styles.historyTranslation} numberOfLines={1}>
                  {entry.translatedText}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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

  // Language Row
  languageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 20,
  },
  langSelector: {
    flex: 1,
  },
  langLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  langButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  langFlag: {
    fontSize: 20,
  },
  langName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  langArrow: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
  },
  langDropdown: {
    position: "absolute",
    top: 72,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,14,20,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    maxHeight: 180,
    zIndex: 100,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  langOptionActive: {
    backgroundColor: "rgba(0,229,160,0.15)",
  },
  langOptionFlag: {
    fontSize: 18,
  },
  langOptionName: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,229,160,0.15)",
    borderWidth: 1,
    borderColor: "rgba(0,229,160,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  swapIcon: {
    color: "#00E5A0",
    fontSize: 18,
    fontWeight: "800",
  },

  // Input Box
  inputBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    minHeight: 140,
  },
  input: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
    minHeight: 80,
  },
  inputActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 12,
  },
  inputAction: {
    padding: 8,
  },
  inputActionIcon: {
    fontSize: 20,
  },
  charCount: {
    position: "absolute",
    bottom: 8,
    left: 16,
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
  },

  // Translate Button
  translateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00E5A0",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 20,
  },
  translateButtonIcon: {
    fontSize: 20,
  },
  translateButtonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Output Box
  outputBox: {
    backgroundColor: "rgba(0,229,160,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,229,160,0.2)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  outputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  outputLabel: {
    color: "#00E5A0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  outputActions: {
    flexDirection: "row",
    gap: 16,
  },
  outputAction: {
    padding: 4,
  },
  outputActionText: {
    fontSize: 20,
  },
  outputText: {
    color: "#fff",
    fontSize: 17,
    lineHeight: 26,
  },

  // History
  historySection: {
    marginTop: 8,
  },
  historyTitle: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  historyItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  historyLangs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  historyLang: {
    fontSize: 16,
  },
  historyArrow: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  historyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginBottom: 4,
  },
  historyTranslation: {
    color: "#00E5A0",
    fontSize: 13,
  },
});
