/**
 * VoxType Screen — Text Translation + Phrase Dictionary
 * 
 * Type or paste text → instant translation → back-translation verification
 * Browse 200+ curated phrases by category
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Keyboard,
  FlatList,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  translate,
  backTranslate,
  LANGUAGES,
  PHRASE_CATEGORIES,
  type Language,
  type PhraseCategory,
} from '../services/translation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = 'translate' | 'phrases';

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE SELECTOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function LanguageSelector({
  label,
  selected,
  onSelect,
  languages,
}: {
  label: string;
  selected: Language;
  onSelect: (lang: Language) => void;
  languages: Language[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.langSelector}>
      <Text style={styles.langLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.langButton}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={styles.langFlag}>{selected.flag}</Text>
        <Text style={styles.langName}>{selected.name}</Text>
        <Text style={styles.langArrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <ScrollView style={styles.langDropdown} nestedScrollEnabled>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langOption,
                lang.code === selected.code && styles.langOptionSelected,
              ]}
              onPress={() => {
                onSelect(lang);
                setOpen(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.langOptionFlag}>{lang.flag}</Text>
              <Text style={styles.langOptionName}>{lang.name}</Text>
              <Text style={styles.langOptionNative}>{lang.nativeName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHRASE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function PhraseCard({
  phrase,
  onTranslate,
}: {
  phrase: { en: string; es: string };
  onTranslate: (text: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.phraseCard}
      onPress={() => {
        onTranslate(phrase.en);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      activeOpacity={0.7}
    >
      <Text style={styles.phraseEn}>{phrase.en}</Text>
      <Text style={styles.phraseEs}>{phrase.es}</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoxTypeScreen() {
  // State
  const [tab, setTab] = useState<Tab>('translate');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [backTranslatedText, setBackTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceLang, setSourceLang] = useState(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState(LANGUAGES[1]); // Spanish
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [translationSource, setTranslationSource] = useState('');
  const [confidence, setConfidence] = useState(0);

  const translateTimeout = useRef<ReturnType<typeof setTimeout>>();

  // ─────────────────────────────────────────────
  // TRANSLATE HANDLER
  // ─────────────────────────────────────────────

  const handleTranslate = useCallback(
    async (text?: string) => {
      const input = text || inputText;
      if (!input.trim()) {
        setTranslatedText('');
        setBackTranslatedText('');
        return;
      }

      if (text) setInputText(text);
      setIsTranslating(true);

      try {
        const result = await translate(input, sourceLang.code, targetLang.code);
        setTranslatedText(result.translatedText);
        setTranslationSource(result.source);
        setConfidence(result.confidence);

        // Back-translate for verification
        const back = await backTranslate(
          result.translatedText,
          targetLang.code,
          sourceLang.code
        );
        setBackTranslatedText(back);
      } catch (e) {
        console.error('[VoxType] Translation error:', e);
        setTranslatedText('Translation failed. Try again.');
      } finally {
        setIsTranslating(false);
      }
    },
    [inputText, sourceLang, targetLang]
  );

  // Auto-translate with debounce
  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (translateTimeout.current) clearTimeout(translateTimeout.current);
      translateTimeout.current = setTimeout(() => {
        if (text.trim().length > 2) handleTranslate(text);
      }, 600);
    },
    [handleTranslate]
  );

  // ─────────────────────────────────────────────
  // SWAP LANGUAGES
  // ─────────────────────────────────────────────

  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText('');
      setBackTranslatedText('');
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [sourceLang, targetLang, translatedText]);

  // ─────────────────────────────────────────────
  // COPY / SHARE
  // ─────────────────────────────────────────────

  const copyTranslation = async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const shareTranslation = async () => {
    if (!translatedText) return;
    await Share.share({
      message: `${inputText}\n\n${targetLang.flag} ${translatedText}`,
    });
  };

  // ─────────────────────────────────────────────
  // CONFIDENCE INDICATOR
  // ─────────────────────────────────────────────

  const getConfidenceColor = () => {
    if (confidence >= 0.8) return '#00E676';
    if (confidence >= 0.5) return '#FFD600';
    return '#FF5252';
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VoxType</Text>
        <Text style={styles.headerSubtitle}>Text Translation</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'translate' && styles.tabActive]}
          onPress={() => setTab('translate')}
        >
          <Text style={[styles.tabText, tab === 'translate' && styles.tabTextActive]}>
            Translate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'phrases' && styles.tabActive]}
          onPress={() => setTab('phrases')}
        >
          <Text style={[styles.tabText, tab === 'phrases' && styles.tabTextActive]}>
            Phrases
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'translate' ? (
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Language Selectors */}
          <View style={styles.langRow}>
            <LanguageSelector
              label="From"
              selected={sourceLang}
              onSelect={setSourceLang}
              languages={LANGUAGES}
            />
            <TouchableOpacity style={styles.swapButton} onPress={swapLanguages}>
              <Text style={styles.swapIcon}>⇄</Text>
            </TouchableOpacity>
            <LanguageSelector
              label="To"
              selected={targetLang}
              onSelect={setTargetLang}
              languages={LANGUAGES}
            />
          </View>

          {/* Input */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>
              {sourceLang.flag} {sourceLang.name}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Type or paste text to translate..."
              placeholderTextColor="#666"
              multiline
              value={inputText}
              onChangeText={handleTextChange}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => {
                Keyboard.dismiss();
                handleTranslate();
              }}
            />
            {inputText.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setInputText('');
                  setTranslatedText('');
                  setBackTranslatedText('');
                }}
              >
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Translate Button */}
          <TouchableOpacity
            style={[styles.translateButton, isTranslating && styles.translateButtonDisabled]}
            onPress={() => handleTranslate()}
            disabled={isTranslating || !inputText.trim()}
            activeOpacity={0.8}
          >
            {isTranslating ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.translateButtonText}>Translate</Text>
            )}
          </TouchableOpacity>

          {/* Translation Output */}
          {translatedText ? (
            <View style={styles.outputCard}>
              <View style={styles.outputHeader}>
                <Text style={styles.outputLabel}>
                  {targetLang.flag} {targetLang.name}
                </Text>
                {translationSource !== 'passthrough' && (
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor() + '20' }]}>
                    <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
                    <Text style={[styles.confidenceText, { color: getConfidenceColor() }]}>
                      {Math.round(confidence * 100)}%
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.outputText}>{translatedText}</Text>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={copyTranslation}>
                  <Text style={styles.actionIcon}>📋</Text>
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={shareTranslation}>
                  <Text style={styles.actionIcon}>📤</Text>
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Back Translation Verification */}
              {backTranslatedText ? (
                <View style={styles.backTranslation}>
                  <Text style={styles.backLabel}>🔄 Verification (back-translated)</Text>
                  <Text style={styles.backText}>{backTranslatedText}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        /* PHRASES TAB */
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryRow}
            contentContainerStyle={styles.categoryContent}
          >
            <TouchableOpacity
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {PHRASE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat.id && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Phrase List */}
          {PHRASE_CATEGORIES.filter(
            (cat) => !selectedCategory || cat.id === selectedCategory
          ).map((category) => (
            <View key={category.id} style={styles.phraseCategoryBlock}>
              <Text style={styles.phraseCategoryTitle}>
                {category.icon} {category.name}
              </Text>
              {category.phrases.map((phrase, i) => (
                <PhraseCard
                  key={`${category.id}-${i}`}
                  phrase={phrase}
                  onTranslate={(text) => {
                    setTab('translate');
                    handleTranslate(text);
                  }}
                />
              ))}
            </View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  // Header
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerSubtitle: { fontSize: 14, color: '#00E676', marginTop: 2 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#00E676' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#000' },

  content: { flex: 1, paddingHorizontal: 20 },

  // Language Selectors
  langRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  langSelector: { flex: 1 },
  langLabel: { fontSize: 12, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  langFlag: { fontSize: 20, marginRight: 8 },
  langName: { fontSize: 15, color: '#fff', flex: 1 },
  langArrow: { fontSize: 10, color: '#666' },
  langDropdown: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  langOption: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  langOptionSelected: { backgroundColor: '#00E67620' },
  langOptionFlag: { fontSize: 18, marginRight: 8 },
  langOptionName: { fontSize: 14, color: '#fff', flex: 1 },
  langOptionNative: { fontSize: 12, color: '#888' },

  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginTop: 24,
  },
  swapIcon: { fontSize: 20, color: '#000', fontWeight: '700' },

  // Input Card
  inputCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 12,
  },
  inputLabel: { fontSize: 13, color: '#888', marginBottom: 8 },
  textInput: {
    fontSize: 17,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  clearButton: { position: 'absolute', top: 12, right: 12, padding: 4 },
  clearText: { fontSize: 16, color: '#666' },

  // Translate Button
  translateButton: {
    backgroundColor: '#00E676',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  translateButtonDisabled: { opacity: 0.5 },
  translateButtonText: { fontSize: 17, fontWeight: '700', color: '#000' },

  // Output Card
  outputCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00E67640',
  },
  outputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  outputLabel: { fontSize: 13, color: '#888' },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidenceDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  confidenceText: { fontSize: 12, fontWeight: '600' },
  outputText: { fontSize: 18, color: '#fff', lineHeight: 26, marginBottom: 12 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionIcon: { fontSize: 16 },
  actionText: { fontSize: 14, color: '#fff', fontWeight: '500' },

  // Back Translation
  backTranslation: {
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00E67640',
  },
  backLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  backText: { fontSize: 14, color: '#ccc', lineHeight: 20 },

  // Categories
  categoryRow: { marginBottom: 16 },
  categoryContent: { gap: 8, paddingRight: 20 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  categoryChipActive: { backgroundColor: '#00E67620', borderColor: '#00E676' },
  categoryIcon: { fontSize: 16 },
  categoryChipText: { fontSize: 13, color: '#888', fontWeight: '500' },
  categoryChipTextActive: { color: '#00E676' },

  // Phrase Cards
  phraseCategoryBlock: { marginBottom: 24 },
  phraseCategoryTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  phraseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  phraseEn: { fontSize: 15, color: '#fff', marginBottom: 4 },
  phraseEs: { fontSize: 14, color: '#00E676' },
});
