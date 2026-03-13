/**
 * vox-note.tsx — VoxNote Screen
 *
 * Voice-to-text notes with translation.
 * Record your voice, get transcription, and translate.
 *
 * Features:
 * - Voice recording with live transcription
 * - Instant translation of notes
 * - Save and organize notes
 * - Copy, share, or speak notes
 *
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Speech from "expo-speech";
import { LANGUAGES, type LanguageCode, getLanguageByCode } from "../constants/ble";
import { translationService } from "../services/translation";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VoxNote {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORDING BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function RecordButton({
  isRecording,
  onPress,
}: {
  isRecording: boolean;
  onPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  return (
    <TouchableOpacity
      style={styles.recordButtonOuter}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          styles.recordPulse,
          isRecording && styles.recordPulseActive,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <View
        style={[
          styles.recordButton,
          isRecording && styles.recordButtonActive,
        ]}
      >
        <Text style={styles.recordIcon}>{isRecording ? "⏹️" : "🎙️"}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoxNoteScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState<LanguageCode>("en");
  const [targetLang, setTargetLang] = useState<LanguageCode>("es");
  const [notes, setNotes] = useState<VoxNote[]>([]);

  // Speech recognition events
  useSpeechRecognitionEvent("start", () => {
    setIsRecording(true);
    setLiveText("");
    setFinalText("");
    setTranslatedText("");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecording(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const results = event.results;
    if (results && results.length > 0) {
      const lastResult = results[results.length - 1];
      const text = lastResult && "transcript" in lastResult
        ? (lastResult as { transcript: string }).transcript
        : "";
      const isFinal = event.isFinal ?? false;
      if (isFinal) {
        setFinalText((prev) => prev + (prev ? " " : "") + text);
        setLiveText("");
      } else {
        setLiveText(text);
      }
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.error("[VoxNote] Speech recognition error:", event.error);
    setIsRecording(false);
  });

  // Toggle recording
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await ExpoSpeechRecognitionModule.stop();
    } else {
      try {
        const permission =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Permission Required",
            "Please grant microphone access to record notes."
          );
          return;
        }

        await ExpoSpeechRecognitionModule.start({
          lang: sourceLang,
          interimResults: true,
          continuous: true,
        });
      } catch (error) {
        console.error("[VoxNote] Failed to start recording:", error);
        Alert.alert("Error", "Failed to start voice recording");
      }
    }
  }, [isRecording, sourceLang]);

  // Translate note
  const handleTranslate = useCallback(async () => {
    const textToTranslate = finalText.trim();
    if (!textToTranslate || isTranslating) return;

    setIsTranslating(true);
    try {
      const result = await translationService.translate(
        textToTranslate,
        sourceLang,
        targetLang
      );

      if (result.success) {
        setTranslatedText(result.translatedText);
      } else {
        Alert.alert("Translation Error", result.error || "Failed to translate");
      }
    } catch (error) {
      console.error("[VoxNote] Translation error:", error);
      Alert.alert("Error", "Failed to translate note");
    } finally {
      setIsTranslating(false);
    }
  }, [finalText, sourceLang, targetLang, isTranslating]);

  // Save note
  const handleSaveNote = useCallback(() => {
    if (!finalText.trim()) return;

    const note: VoxNote = {
      id: Date.now().toString(),
      originalText: finalText.trim(),
      translatedText: translatedText,
      sourceLang,
      targetLang,
      createdAt: Date.now(),
    };

    setNotes((prev) => [note, ...prev.slice(0, 19)]);
    Alert.alert("Saved!", "Note saved successfully");
  }, [finalText, translatedText, sourceLang, targetLang]);

  // Copy text
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
      } catch {
        setIsSpeaking(false);
      }
    },
    [isSpeaking]
  );

  // Clear current note
  const handleClear = useCallback(() => {
    setLiveText("");
    setFinalText("");
    setTranslatedText("");
  }, []);

  // Load saved note
  const handleLoadNote = useCallback((note: VoxNote) => {
    setFinalText(note.originalText);
    setTranslatedText(note.translatedText);
    setSourceLang(note.sourceLang);
    setTargetLang(note.targetLang);
  }, []);

  // Delete note
  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const displayText = finalText + (liveText ? " " + liveText : "");

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
            <Text style={styles.title}>VoxNote</Text>
            <Text style={styles.subtitle}>Voice notes with translation</Text>
          </View>
        </View>

        {/* Language Display */}
        <View style={styles.langRow}>
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeFlag}>
              {getLanguageByCode(sourceLang).flag}
            </Text>
            <Text style={styles.langBadgeName}>
              {getLanguageByCode(sourceLang).name}
            </Text>
          </View>
          <Text style={styles.langArrow}>→</Text>
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeFlag}>
              {getLanguageByCode(targetLang).flag}
            </Text>
            <Text style={styles.langBadgeName}>
              {getLanguageByCode(targetLang).name}
            </Text>
          </View>
        </View>

        {/* Recording Section */}
        <View style={styles.recordSection}>
          <RecordButton
            isRecording={isRecording}
            onPress={handleToggleRecording}
          />
          <Text style={styles.recordHint}>
            {isRecording ? "Recording... Tap to stop" : "Tap to record"}
          </Text>
        </View>

        {/* Transcript Display */}
        {displayText && (
          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptLabel}>Your Note</Text>
              <View style={styles.transcriptActions}>
                <TouchableOpacity
                  style={styles.transcriptAction}
                  onPress={() => handleSpeak(displayText, sourceLang)}
                >
                  <Text style={styles.actionIcon}>
                    {isSpeaking ? "⏹️" : "🔊"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.transcriptAction}
                  onPress={() => handleCopy(displayText)}
                >
                  <Text style={styles.actionIcon}>📋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.transcriptAction}
                  onPress={handleClear}
                >
                  <Text style={styles.actionIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.transcriptText}>
              {finalText}
              {liveText && (
                <Text style={styles.liveText}> {liveText}</Text>
              )}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {finalText && !isRecording && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.translateBtn,
                isTranslating && styles.buttonDisabled,
              ]}
              onPress={handleTranslate}
              disabled={isTranslating}
            >
              {isTranslating ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Text style={styles.translateBtnIcon}>🌐</Text>
                  <Text style={styles.translateBtnText}>Translate</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveNote}
            >
              <Text style={styles.saveBtnIcon}>💾</Text>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Translation Display */}
        {translatedText && (
          <View style={styles.translationBox}>
            <View style={styles.translationHeader}>
              <Text style={styles.translationLabel}>Translation</Text>
              <View style={styles.translationActions}>
                <TouchableOpacity
                  style={styles.transcriptAction}
                  onPress={() => handleSpeak(translatedText, targetLang)}
                >
                  <Text style={styles.actionIcon}>
                    {isSpeaking ? "⏹️" : "🔊"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.transcriptAction}
                  onPress={() => handleCopy(translatedText)}
                >
                  <Text style={styles.actionIcon}>📋</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.translationText}>{translatedText}</Text>
          </View>
        )}

        {/* Saved Notes */}
        {notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Saved Notes</Text>
            {notes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <TouchableOpacity
                  style={styles.noteContent}
                  onPress={() => handleLoadNote(note)}
                >
                  <View style={styles.noteLangs}>
                    <Text style={styles.noteFlag}>
                      {getLanguageByCode(note.sourceLang).flag}
                    </Text>
                    <Text style={styles.noteArrow}>→</Text>
                    <Text style={styles.noteFlag}>
                      {getLanguageByCode(note.targetLang).flag}
                    </Text>
                  </View>
                  <Text style={styles.noteOriginal} numberOfLines={2}>
                    {note.originalText}
                  </Text>
                  {note.translatedText && (
                    <Text style={styles.noteTranslation} numberOfLines={1}>
                      {note.translatedText}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.noteDelete}
                  onPress={() => handleDeleteNote(note.id)}
                >
                  <Text style={styles.noteDeleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!displayText && !isRecording && notes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎙️</Text>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyDesc}>
              Tap the microphone to record your first voice note
            </Text>
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
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 32,
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  langBadgeFlag: {
    fontSize: 18,
  },
  langBadgeName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
  langArrow: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 16,
  },

  // Recording Section
  recordSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  recordButtonOuter: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  recordPulse: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(249,115,22,0.1)",
  },
  recordPulseActive: {
    backgroundColor: "rgba(239,68,68,0.2)",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 3,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "#ef4444",
  },
  recordIcon: {
    fontSize: 32,
  },
  recordHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Transcript Box
  transcriptBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  transcriptLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  transcriptActions: {
    flexDirection: "row",
    gap: 12,
  },
  transcriptAction: {
    padding: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  transcriptText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
  },
  liveText: {
    color: "rgba(249,115,22,0.8)",
    fontStyle: "italic",
  },

  // Action Row
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  translateBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00E5A0",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  translateBtnIcon: {
    fontSize: 18,
  },
  translateBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  saveBtnIcon: {
    fontSize: 16,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Translation Box
  translationBox: {
    backgroundColor: "rgba(0,229,160,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,229,160,0.2)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  translationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  translationLabel: {
    color: "#00E5A0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  translationActions: {
    flexDirection: "row",
    gap: 12,
  },
  translationText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
  },

  // Notes Section
  notesSection: {
    marginTop: 8,
  },
  notesTitle: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  noteCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  noteContent: {
    flex: 1,
    padding: 14,
  },
  noteLangs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  noteFlag: {
    fontSize: 14,
  },
  noteArrow: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 10,
  },
  noteOriginal: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  noteTranslation: {
    color: "#00E5A0",
    fontSize: 13,
  },
  noteDelete: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  noteDeleteIcon: {
    fontSize: 16,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyDesc: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});
