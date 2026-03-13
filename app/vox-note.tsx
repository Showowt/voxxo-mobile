/**
 * VoxNote Screen — Voice Message Translation
 * 
 * Record voice → live speech-to-text → translate → verify with back-translation → share
 * WhatsApp-style voice message workflow
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Animated,
  Dimensions,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  translate,
  backTranslate,
  LANGUAGES,
  type Language,
} from '../services/translation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

interface VoxNoteResult {
  originalText: string;
  translatedText: string;
  backTranslatedText: string;
  sourceLang: Language;
  targetLang: Language;
  confidence: number;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORDING ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════

function RecordingWave({ isActive }: { isActive: boolean }) {
  const bars = Array.from({ length: 12 }, (_, i) => {
    const anim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
      if (isActive) {
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 80),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.8,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        anim.setValue(0.3);
      }
    }, [isActive, anim]);

    return anim;
  });

  return (
    <View style={styles.waveContainer}>
      {bars.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              transform: [{ scaleY: anim }],
              backgroundColor: isActive ? '#00E676' : '#333',
            },
          ]}
        />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMER DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function RecordingTimer({ isRunning }: { isRunning: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (isRunning) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');

  return (
    <Text style={[styles.timer, isRunning && styles.timerActive]}>
      {mm}:{ss}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT CARD
// ═══════════════════════════════════════════════════════════════════════════════

function ResultCard({ result }: { result: VoxNoteResult }) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(result.translatedText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShare = async () => {
    await Share.share({
      message: `${result.sourceLang.flag} ${result.originalText}\n\n${result.targetLang.flag} ${result.translatedText}`,
    });
  };

  const handleSpeak = () => {
    Speech.speak(result.translatedText, {
      language: result.targetLang.code,
      rate: 0.9,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.resultCard}>
      {/* Original */}
      <View style={styles.resultSection}>
        <Text style={styles.resultLabel}>
          {result.sourceLang.flag} Original
        </Text>
        <Text style={styles.resultOriginal}>{result.originalText}</Text>
      </View>

      {/* Arrow */}
      <View style={styles.resultArrow}>
        <Text style={styles.resultArrowText}>↓</Text>
      </View>

      {/* Translated */}
      <View style={[styles.resultSection, styles.resultTranslated]}>
        <Text style={styles.resultLabel}>
          {result.targetLang.flag} Translation
        </Text>
        <Text style={styles.resultTranslatedText}>{result.translatedText}</Text>
      </View>

      {/* Actions */}
      <View style={styles.resultActions}>
        <TouchableOpacity style={styles.resultAction} onPress={handleSpeak}>
          <Text style={styles.resultActionIcon}>🔊</Text>
          <Text style={styles.resultActionText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resultAction} onPress={handleCopy}>
          <Text style={styles.resultActionIcon}>📋</Text>
          <Text style={styles.resultActionText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resultAction} onPress={handleShare}>
          <Text style={styles.resultActionIcon}>📤</Text>
          <Text style={styles.resultActionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Back Translation */}
      {result.backTranslatedText ? (
        <View style={styles.backVerify}>
          <Text style={styles.backVerifyLabel}>🔄 Verification</Text>
          <Text style={styles.backVerifyText}>{result.backTranslatedText}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoxNoteScreen() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [sourceLang, setSourceLang] = useState(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState(LANGUAGES[1]); // Spanish
  const [liveText, setLiveText] = useState('');
  const [results, setResults] = useState<VoxNoteResult[]>([]);
  const [showLangPicker, setShowLangPicker] = useState<'source' | 'target' | null>(null);

  // ─────────────────────────────────────────────
  // RECORDING HANDLERS
  // ─────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setRecordingState('recording');
    setLiveText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // In production: start expo-speech-recognition
    // For demo: simulate live text appearing
    const demoTexts = [
      'Hello, I wanted to ask you something',
      'Can you tell me where the nearest restaurant is?',
      'I really enjoyed meeting you today',
      'What time does the store close?',
      'I would like to make a reservation for two',
    ];
    const demo = demoTexts[Math.floor(Math.random() * demoTexts.length)];

    // Simulate words appearing
    const words = demo.split(' ');
    let current = '';
    for (let i = 0; i < words.length; i++) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
      current += (i > 0 ? ' ' : '') + words[i];
      setLiveText(current);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!liveText.trim()) {
      setRecordingState('idle');
      return;
    }

    setRecordingState('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await translate(liveText, sourceLang.code, targetLang.code);
      const backResult = await backTranslate(
        result.translatedText,
        targetLang.code,
        sourceLang.code
      );

      const newResult: VoxNoteResult = {
        originalText: liveText,
        translatedText: result.translatedText,
        backTranslatedText: backResult,
        sourceLang,
        targetLang,
        confidence: result.confidence,
        timestamp: new Date(),
      };

      setResults((prev) => [newResult, ...prev]);
      setRecordingState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[VoxNote] Translation error:', e);
      setRecordingState('idle');
    }
  }, [liveText, sourceLang, targetLang]);

  // ─────────────────────────────────────────────
  // LANGUAGE PICKER
  // ─────────────────────────────────────────────

  if (showLangPicker) {
    const isSource = showLangPicker === 'source';
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setShowLangPicker(null)}>
            <Text style={styles.pickerBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>
            {isSource ? 'I speak' : 'Translate to'}
          </Text>
        </View>
        <ScrollView style={styles.content}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.pickerOption,
                (isSource ? sourceLang : targetLang).code === lang.code && styles.pickerOptionActive,
              ]}
              onPress={() => {
                if (isSource) setSourceLang(lang);
                else setTargetLang(lang);
                setShowLangPicker(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.pickerFlag}>{lang.flag}</Text>
              <Text style={styles.pickerName}>{lang.name}</Text>
              <Text style={styles.pickerNative}>{lang.nativeName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VoxNote</Text>
        <Text style={styles.headerSubtitle}>Voice Message Translation</Text>
      </View>

      {/* Language Row */}
      <View style={styles.langRow}>
        <TouchableOpacity
          style={styles.langPill}
          onPress={() => setShowLangPicker('source')}
        >
          <Text style={styles.langPillFlag}>{sourceLang.flag}</Text>
          <Text style={styles.langPillText}>{sourceLang.name}</Text>
        </TouchableOpacity>
        <Text style={styles.langArrowIcon}>→</Text>
        <TouchableOpacity
          style={styles.langPill}
          onPress={() => setShowLangPicker('target')}
        >
          <Text style={styles.langPillFlag}>{targetLang.flag}</Text>
          <Text style={styles.langPillText}>{targetLang.name}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recording Area */}
        <View style={styles.recordingArea}>
          <RecordingWave isActive={recordingState === 'recording'} />
          <RecordingTimer isRunning={recordingState === 'recording'} />

          {/* Live Text */}
          {liveText ? (
            <Text style={styles.liveText}>{liveText}</Text>
          ) : recordingState === 'recording' ? (
            <Text style={styles.liveTextPlaceholder}>Listening...</Text>
          ) : null}

          {/* Processing */}
          {recordingState === 'processing' && (
            <View style={styles.processingRow}>
              <ActivityIndicator color="#00E676" />
              <Text style={styles.processingText}>Translating...</Text>
            </View>
          )}
        </View>

        {/* Record Button */}
        <TouchableOpacity
          style={[
            styles.recordButton,
            recordingState === 'recording' && styles.recordButtonActive,
          ]}
          onPress={() => {
            if (recordingState === 'recording') {
              stopRecording();
            } else {
              startRecording();
            }
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.recordDot,
              recordingState === 'recording' && styles.recordDotActive,
            ]}
          />
          <Text style={styles.recordButtonText}>
            {recordingState === 'recording'
              ? 'Stop & Translate'
              : recordingState === 'processing'
              ? 'Processing...'
              : 'Hold to Record'}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {results.map((result, i) => (
          <ResultCard key={i} result={result} />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerSubtitle: { fontSize: 14, color: '#00E676', marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 20 },

  // Language Row
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  langPillFlag: { fontSize: 20 },
  langPillText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  langArrowIcon: { fontSize: 18, color: '#00E676', fontWeight: '700' },

  // Recording Area
  recordingArea: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 160,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, marginBottom: 12 },
  waveBar: { width: 3, height: 40, borderRadius: 2 },
  timer: { fontSize: 32, fontWeight: '300', color: '#555', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  timerActive: { color: '#00E676' },
  liveText: { fontSize: 16, color: '#fff', textAlign: 'center', marginTop: 12, lineHeight: 22 },
  liveTextPlaceholder: { fontSize: 14, color: '#555', marginTop: 12 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  processingText: { fontSize: 14, color: '#888' },

  // Record Button
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 30,
    paddingVertical: 18,
    marginBottom: 24,
    gap: 10,
    borderWidth: 2,
    borderColor: '#FF5252',
  },
  recordButtonActive: { borderColor: '#00E676', backgroundColor: '#00E67610' },
  recordDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF5252' },
  recordDotActive: { backgroundColor: '#00E676', borderRadius: 3 },
  recordButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // Result Card
  resultCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  resultSection: { marginBottom: 8 },
  resultLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  resultOriginal: { fontSize: 15, color: '#ccc', lineHeight: 22 },
  resultArrow: { alignItems: 'center', paddingVertical: 4 },
  resultArrowText: { fontSize: 18, color: '#00E676' },
  resultTranslated: { backgroundColor: '#00E67610', borderRadius: 12, padding: 12 },
  resultTranslatedText: { fontSize: 17, color: '#00E676', lineHeight: 24, fontWeight: '500' },

  resultActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  resultAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  resultActionIcon: { fontSize: 14 },
  resultActionText: { fontSize: 13, color: '#fff', fontWeight: '500' },

  backVerify: {
    marginTop: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00E67640',
  },
  backVerifyLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  backVerifyText: { fontSize: 13, color: '#aaa', lineHeight: 18 },

  // Language Picker
  pickerHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  pickerBack: { fontSize: 16, color: '#00E676', fontWeight: '600' },
  pickerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 12,
  },
  pickerOptionActive: { backgroundColor: '#00E67610' },
  pickerFlag: { fontSize: 24 },
  pickerName: { fontSize: 16, color: '#fff', flex: 1 },
  pickerNative: { fontSize: 14, color: '#888' },
});
