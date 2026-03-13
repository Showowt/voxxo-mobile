/**
 * Voxxo Home Screen — Tabbed Interface
 *
 * 6 modes: Type | Voice | Ear | Face | Call | Mute
 * Dark luxury aesthetic with green/purple accents
 *
 * @version 2.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  TextInput,
  Platform,
  Share,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import {
  translate,
  backTranslate,
  LANGUAGES,
  type Language,
} from "../services/translation";
import {
  generateRoomCode,
  shareConversationLink,
  getShareableUrl,
} from "../lib/link-generator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabId = "type" | "voice" | "ear" | "face" | "call" | "mute";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "type", label: "Type", icon: "⌨️" },
  { id: "voice", label: "Voice", icon: "🎙️" },
  { id: "ear", label: "Ear", icon: "🎧" },
  { id: "face", label: "Face", icon: "💬" },
  { id: "call", label: "Call", icon: "📹" },
  { id: "mute", label: "", icon: "🔇" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE GRID COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function LanguageGrid({
  selected,
  onSelect,
}: {
  selected: Language;
  onSelect: (lang: Language) => void;
}) {
  return (
    <View style={styles.langGrid}>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[
            styles.langGridItem,
            selected.code === lang.code && styles.langGridItemActive,
          ]}
          onPress={() => onSelect(lang)}
        >
          <Text style={styles.langGridFlag}>{lang.flag}</Text>
          <Text style={styles.langGridCode}>{lang.code.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE SELECTOR ROW
// ═══════════════════════════════════════════════════════════════════════════════

function LanguageRow({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  onSwap,
}: {
  sourceLang: Language;
  targetLang: Language;
  onSourceChange: () => void;
  onTargetChange: () => void;
  onSwap: () => void;
}) {
  return (
    <View style={styles.langRow}>
      <TouchableOpacity style={styles.langPill} onPress={onSourceChange}>
        <Text style={styles.langPillFlag}>{sourceLang.flag}</Text>
        <Text style={styles.langPillCode}>{sourceLang.code.toUpperCase()}</Text>
        <Text style={styles.langPillArrow}>▼</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.swapButton} onPress={onSwap}>
        <Text style={styles.swapIcon}>⇄</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.langPill} onPress={onTargetChange}>
        <Text style={styles.langPillFlag}>{targetLang.flag}</Text>
        <Text style={styles.langPillCode}>{targetLang.code.toUpperCase()}</Text>
        <Text style={styles.langPillArrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("type");
  const [sourceLang, setSourceLang] = useState(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState(LANGUAGES[1]); // Spanish
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [userName, setUserName] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Swap languages
  const handleSwap = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText("");
    }
  }, [sourceLang, targetLang, translatedText]);

  // Translate text
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await translate(
        inputText,
        sourceLang.code,
        targetLang.code,
      );
      setTranslatedText(result.translatedText);
    } catch (e) {
      console.error("[Home] Translation error:", e);
    } finally {
      setIsTranslating(false);
    }
  }, [inputText, sourceLang, targetLang, isTranslating]);

  // Share translation
  const handleShare = async () => {
    if (!translatedText) return;
    await Share.share({
      message: `${sourceLang.flag} ${inputText}\n\n${targetLang.flag} ${translatedText}`,
    });
  };

  // Copy translation
  const handleCopy = async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
  };

  // ─────────────────────────────────────────────
  // LANGUAGE PICKER OVERLAY
  // ─────────────────────────────────────────────

  if (showSourcePicker || showTargetPicker) {
    const isSource = showSourcePicker;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity
            onPress={() => {
              setShowSourcePicker(false);
              setShowTargetPicker(false);
            }}
          >
            <Text style={styles.pickerBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>
            {isSource ? "You Speak" : "Translate To"}
          </Text>
        </View>
        <ScrollView style={styles.pickerContent}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.pickerOption,
                (isSource ? sourceLang : targetLang).code === lang.code &&
                  styles.pickerOptionActive,
              ]}
              onPress={() => {
                if (isSource) setSourceLang(lang);
                else setTargetLang(lang);
                setShowSourcePicker(false);
                setShowTargetPicker(false);
              }}
            >
              <Text style={styles.pickerFlag}>{lang.flag}</Text>
              <Text style={styles.pickerName}>{lang.name}</Text>
              <Text style={styles.pickerNative}>{lang.nativeName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER TAB CONTENT
  // ─────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case "type":
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Language Row */}
            <LanguageRow
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceChange={() => setShowSourcePicker(true)}
              onTargetChange={() => setShowTargetPicker(true)}
              onSwap={handleSwap}
            />

            {/* Input */}
            <View style={styles.typeInputCard}>
              <Text style={styles.inputLabel}>
                {sourceLang.flag} Type your message
              </Text>
              <TextInput
                style={styles.typeInput}
                placeholder="Type what you want to say..."
                placeholderTextColor="#555"
                multiline
                value={inputText}
                onChangeText={setInputText}
              />
            </View>

            {/* Translate Button */}
            <TouchableOpacity
              style={[styles.translateBtn, isTranslating && styles.btnDisabled]}
              onPress={handleTranslate}
              disabled={isTranslating || !inputText.trim()}
            >
              {isTranslating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.translateBtnText}>Translate</Text>
              )}
            </TouchableOpacity>

            {/* Output */}
            {translatedText ? (
              <View style={styles.outputCard}>
                <Text style={styles.outputLabel}>
                  {targetLang.flag} Translation
                </Text>
                <Text style={styles.outputText}>{translatedText}</Text>
                <View style={styles.outputActions}>
                  <TouchableOpacity
                    style={styles.outputAction}
                    onPress={handleCopy}
                  >
                    <Text style={styles.outputActionIcon}>📋</Text>
                    <Text style={styles.outputActionText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.outputAction}
                    onPress={handleShare}
                  >
                    <Text style={styles.outputActionIcon}>📤</Text>
                    <Text style={styles.outputActionText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* How it works */}
            <View style={styles.howItWorks}>
              <Text style={styles.howTitle}>💬 How it works</Text>
              <Text style={styles.howStep}>1. Type your message</Text>
              <Text style={styles.howStep}>
                2. Check verification matches your intent
              </Text>
              <Text style={styles.howStep}>3. Tap Share or Copy</Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case "voice":
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Language Row */}
            <LanguageRow
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceChange={() => setShowSourcePicker(true)}
              onTargetChange={() => setShowTargetPicker(true)}
              onSwap={handleSwap}
            />

            {/* Mic Button */}
            <TouchableOpacity
              style={[styles.micButton, isRecording && styles.micButtonActive]}
              onPress={() => router.push("/vox-note")}
            >
              <View
                style={[styles.micIcon, isRecording && styles.micIconActive]}
              >
                <Text style={styles.micEmoji}>🎙️</Text>
              </View>
              <Text style={styles.micLabel}>Tap to record</Text>
            </TouchableOpacity>

            {/* Tip */}
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>💡 Tip</Text>
              <Text style={styles.tipText}>
                Play a WhatsApp voice message on speaker, then tap record to
                translate!
              </Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case "ear":
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Wingman Icon */}
            <View style={styles.wingmanHeader}>
              <View style={styles.wingmanIconContainer}>
                <Text style={styles.wingmanIcon}>🎧</Text>
              </View>
              <Text style={styles.wingmanTitle}>Wingman Mode</Text>
              <Text style={styles.wingmanSubtitle}>
                AI whispers what to say in your AirPods
              </Text>
            </View>

            {/* Modes */}
            <View style={styles.wingmanModes}>
              <Text style={styles.wingmanModeItem}>
                💕 Date Mode — First dates, crushes, spark
              </Text>
              <Text style={styles.wingmanModeItem}>
                🎯 Interview Mode — Jobs, pitches, negotiations
              </Text>
              <Text style={styles.wingmanModeItem}>
                ⚡ Sales Mode — Close deals, handle objections
              </Text>
              <Text style={styles.wingmanModeItem}>
                🌊 Hard Talk — Conflict, honesty, repair
              </Text>
            </View>

            {/* Activate Button */}
            <TouchableOpacity
              style={styles.wingmanButton}
              onPress={() => router.push("/wingman")}
            >
              <Text style={styles.wingmanButtonIcon}>🎧</Text>
              <Text style={styles.wingmanButtonText}>Activate Wingman</Text>
            </TouchableOpacity>

            <Text style={styles.wingmanNote}>
              Connect AirPods for best experience
            </Text>

            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case "face":
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* True Face-to-Face */}
            <TouchableOpacity
              style={styles.faceOptionPrimary}
              onPress={() => router.push("/face-to-face")}
            >
              <Text style={styles.faceOptionIcon}>🗣️</Text>
              <Text style={styles.faceOptionTitle}>
                True Face-to-Face (One Device)
              </Text>
            </TouchableOpacity>
            <Text style={styles.faceOptionDesc}>
              Place phone between two people - each speaks their language
            </Text>

            {/* Remote Talk */}
            <TouchableOpacity style={styles.faceOptionSecondary}>
              <Text style={styles.faceOptionSecondaryTitle}>
                Remote Talk: Each person uses their own phone
              </Text>
            </TouchableOpacity>

            {/* Name Input */}
            <View style={styles.nameInputContainer}>
              <Text style={styles.nameLabel}>Your Name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                placeholderTextColor="#555"
                value={userName}
                onChangeText={setUserName}
              />
            </View>

            {/* Language Grid */}
            <Text style={styles.langGridLabel}>You Speak</Text>
            <LanguageGrid selected={sourceLang} onSelect={setSourceLang} />

            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case "call":
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Video Call Option */}
            <View style={styles.callOption}>
              <Text style={styles.callOptionTitle}>
                Video Call: Remote calls with live translation
              </Text>
            </View>

            {/* Name Input */}
            <View style={styles.nameInputContainer}>
              <Text style={styles.nameLabel}>Your Name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                placeholderTextColor="#555"
                value={userName}
                onChangeText={setUserName}
              />
            </View>

            {/* Language Grid */}
            <Text style={styles.langGridLabel}>You Speak</Text>
            <LanguageGrid selected={sourceLang} onSelect={setSourceLang} />

            <View style={{ height: 100 }} />
          </ScrollView>
        );

      case "mute":
        return (
          <View style={styles.muteContainer}>
            <Text style={styles.muteIcon}>🔇</Text>
            <Text style={styles.muteTitle}>Silent Mode</Text>
            <Text style={styles.muteDesc}>
              All audio output disabled. Translations will appear as text only.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  // ─────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🔗</Text>
          </View>
        </View>
        <Text style={styles.brandLabel}>MACHINEMIND</Text>
        <Text style={styles.brandName}>Voxxo</Text>
        <Text style={styles.tagline}>Your Voice. Any Language. Instantly.</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            {tab.icon && <Text style={styles.tabIcon}>{tab.icon}</Text>}
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>{renderTabContent()}</View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Chrome recommended • Status</Text>
        <Text style={styles.footerBrand}>
          Powered by <Text style={styles.footerBrandName}>MachineMind</Text>
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
    backgroundColor: "#0A1A14",
  },

  // Header
  header: {
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 40 : 20,
    paddingBottom: 16,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logoIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#1A3A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#2A5A4A",
  },
  logoEmoji: {
    fontSize: 32,
  },
  brandLabel: {
    fontSize: 11,
    color: "#4A8A6A",
    letterSpacing: 3,
    fontWeight: "600",
    marginBottom: 4,
  },
  brandName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#00E676",
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: "#6A9A8A",
    marginTop: 4,
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: "#2A4A3A",
  },
  tabIcon: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize: 12,
    color: "#6A8A7A",
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#00E676",
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Language Row
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  langPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A2A24",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#2A4A3A",
  },
  langPillFlag: {
    fontSize: 18,
  },
  langPillCode: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
    flex: 1,
  },
  langPillArrow: {
    fontSize: 10,
    color: "#6A8A7A",
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00E676",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  swapIcon: {
    fontSize: 18,
    color: "#000",
    fontWeight: "800",
  },

  // Type Tab
  typeInputCard: {
    backgroundColor: "#1A2A24",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A4A3A",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: "#6A8A7A",
    marginBottom: 8,
  },
  typeInput: {
    fontSize: 16,
    color: "#fff",
    minHeight: 80,
    textAlignVertical: "top",
  },
  translateBtn: {
    backgroundColor: "#00E676",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  translateBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  outputCard: {
    backgroundColor: "#1A2A24",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#00E67640",
    marginBottom: 16,
  },
  outputLabel: {
    fontSize: 13,
    color: "#6A8A7A",
    marginBottom: 8,
  },
  outputText: {
    fontSize: 18,
    color: "#00E676",
    lineHeight: 26,
    marginBottom: 12,
  },
  outputActions: {
    flexDirection: "row",
    gap: 12,
  },
  outputAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A1A14",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  outputActionIcon: {
    fontSize: 14,
  },
  outputActionText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "500",
  },
  howItWorks: {
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A4A3A",
  },
  howTitle: {
    fontSize: 15,
    color: "#00E676",
    fontWeight: "600",
    marginBottom: 10,
  },
  howStep: {
    fontSize: 14,
    color: "#8ABAA0",
    marginBottom: 6,
  },

  // Voice Tab
  micButton: {
    alignItems: "center",
    marginVertical: 30,
  },
  micButtonActive: {},
  micIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#00E676",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  micIconActive: {
    backgroundColor: "#FF5252",
  },
  micEmoji: {
    fontSize: 40,
  },
  micLabel: {
    fontSize: 16,
    color: "#8ABAA0",
  },
  tipCard: {
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A4A3A",
  },
  tipTitle: {
    fontSize: 15,
    color: "#00E676",
    fontWeight: "600",
    marginBottom: 6,
  },
  tipText: {
    fontSize: 14,
    color: "#8ABAA0",
    lineHeight: 20,
  },

  // Ear/Wingman Tab
  wingmanHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  wingmanIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6B46C1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  wingmanIcon: {
    fontSize: 36,
  },
  wingmanTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  wingmanSubtitle: {
    fontSize: 14,
    color: "#8ABAA0",
    textAlign: "center",
  },
  wingmanModes: {
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A4A3A",
  },
  wingmanModeItem: {
    fontSize: 14,
    color: "#CADECD",
    marginBottom: 10,
    lineHeight: 20,
  },
  wingmanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6B46C1",
    borderRadius: 14,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 12,
  },
  wingmanButtonIcon: {
    fontSize: 20,
  },
  wingmanButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  wingmanNote: {
    fontSize: 13,
    color: "#6A8A7A",
    textAlign: "center",
  },

  // Face Tab
  faceOptionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00E676",
    borderRadius: 14,
    padding: 18,
    gap: 12,
    marginBottom: 8,
  },
  faceOptionIcon: {
    fontSize: 24,
  },
  faceOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    flex: 1,
  },
  faceOptionDesc: {
    fontSize: 13,
    color: "#8ABAA0",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  faceOptionSecondary: {
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A4A3A",
    marginBottom: 20,
  },
  faceOptionSecondaryTitle: {
    fontSize: 14,
    color: "#00E676",
  },
  nameInputContainer: {
    marginBottom: 20,
  },
  nameLabel: {
    fontSize: 13,
    color: "#6A8A7A",
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: "#1A2A24",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#2A4A3A",
  },
  langGridLabel: {
    fontSize: 13,
    color: "#6A8A7A",
    marginBottom: 12,
  },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  langGridItem: {
    width: (SCREEN_WIDTH - 32 - 30) / 3,
    backgroundColor: "#1A2A24",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A4A3A",
  },
  langGridItemActive: {
    borderColor: "#00E676",
    backgroundColor: "#00E67610",
  },
  langGridFlag: {
    fontSize: 24,
    marginBottom: 6,
  },
  langGridCode: {
    fontSize: 13,
    color: "#8ABAA0",
    fontWeight: "600",
  },

  // Call Tab
  callOption: {
    backgroundColor: "#1A2A24",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#00E67640",
    marginBottom: 20,
  },
  callOptionTitle: {
    fontSize: 14,
    color: "#00E676",
  },

  // Mute Tab
  muteContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  muteIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  muteTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  muteDesc: {
    fontSize: 14,
    color: "#6A8A7A",
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#1A2A24",
  },
  footerText: {
    fontSize: 12,
    color: "#4A6A5A",
    marginBottom: 4,
  },
  footerBrand: {
    fontSize: 12,
    color: "#4A6A5A",
  },
  footerBrandName: {
    color: "#00E676",
    fontWeight: "600",
  },

  // Language Picker
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 16,
    gap: 16,
  },
  pickerBack: {
    fontSize: 16,
    color: "#00E676",
    fontWeight: "600",
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  pickerContent: {
    flex: 1,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2A24",
    gap: 12,
  },
  pickerOptionActive: {
    backgroundColor: "#00E67615",
  },
  pickerFlag: {
    fontSize: 24,
  },
  pickerName: {
    fontSize: 16,
    color: "#fff",
    flex: 1,
  },
  pickerNative: {
    fontSize: 14,
    color: "#6A8A7A",
  },
});
