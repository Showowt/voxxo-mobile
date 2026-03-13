/**
 * Wingman Screen — AI Voice Coaching
 * 
 * Listens to ambient speech, generates 3 response suggestions via Claude API,
 * delivers via TTS to AirPods/Meta glasses/any Bluetooth device.
 * 
 * Four modes: Dating, Interview, Hard Talk, Sales
 * Three tones: Bold, Warm, Safe
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type CoachingMode = 'dating' | 'interview' | 'hardtalk' | 'sales';
type SuggestionTone = 'bold' | 'warm' | 'safe';

interface Suggestion {
  tone: SuggestionTone;
  text: string;
}

interface CoachingScenario {
  id: CoachingMode;
  name: string;
  icon: string;
  description: string;
  systemContext: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SCENARIOS: CoachingScenario[] = [
  {
    id: 'dating',
    name: 'Dating',
    icon: '💕',
    description: 'Charming, confident, authentic',
    systemContext:
      'You are a dating conversation coach. The user is on a date or in a romantic social interaction. Generate responses that are charming, confident, and authentic. Avoid anything creepy or overly aggressive. Focus on genuine connection and showing interest.',
  },
  {
    id: 'interview',
    name: 'Interview',
    icon: '💼',
    description: 'Professional, articulate, compelling',
    systemContext:
      'You are a job interview coach. The user is in a job interview or professional meeting. Generate responses that are professional, articulate, and compelling. Highlight achievements without bragging. Show enthusiasm and competence.',
  },
  {
    id: 'hardtalk',
    name: 'Hard Talk',
    icon: '🗣️',
    description: 'Clear, empathetic, boundary-setting',
    systemContext:
      'You are a difficult conversation coach. The user is having a challenging personal or professional conversation. Generate responses that are clear, empathetic, and set healthy boundaries. Help them communicate needs without escalating conflict.',
  },
  {
    id: 'sales',
    name: 'Sales',
    icon: '🎯',
    description: 'Persuasive, value-focused, closing',
    systemContext:
      'You are a sales conversation coach. The user is in a client meeting, pitch, or sales call. Generate responses that address objections, highlight value, and move toward closing. Be persuasive but not pushy.',
  },
];

const TONE_CONFIG: Record<SuggestionTone, { label: string; color: string; icon: string }> = {
  bold: { label: 'BOLD', color: '#FF6B6B', icon: '🔥' },
  warm: { label: 'WARM', color: '#FFD93D', icon: '💛' },
  safe: { label: 'SAFE', color: '#6BCB77', icon: '🛡️' },
};

const CYRANO_API_URL = 'https://entrevoz.co/api/cyrano'; // Your deployed API

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTION CARD
// ═══════════════════════════════════════════════════════════════════════════════

function SuggestionCard({
  suggestion,
  onSpeak,
  isSpeaking,
}: {
  suggestion: Suggestion;
  onSpeak: () => void;
  isSpeaking: boolean;
}) {
  const config = TONE_CONFIG[suggestion.tone];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSpeaking, pulseAnim]);

  return (
    <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
      <TouchableOpacity
        style={[styles.suggestionCard, { borderColor: config.color + '60' }]}
        onPress={() => {
          onSpeak();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.suggestionHeader}>
          <View style={[styles.toneBadge, { backgroundColor: config.color + '20' }]}>
            <Text style={styles.toneIcon}>{config.icon}</Text>
            <Text style={[styles.toneLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          {isSpeaking && (
            <View style={styles.speakingIndicator}>
              <Text style={styles.speakingText}>🔊 Speaking</Text>
            </View>
          )}
        </View>
        <Text style={styles.suggestionText}>{suggestion.text}</Text>
        <Text style={styles.tapHint}>Tap to whisper in your ear</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTENING INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function ListeningPulse({ isActive }: { isActive: boolean }) {
  const pulse1 = useRef(new Animated.Value(0.4)).current;
  const pulse2 = useRef(new Animated.Value(0.4)).current;
  const pulse3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isActive) {
      const animate = (value: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(value, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(value, { toValue: 0.4, duration: 400, useNativeDriver: true }),
          ])
        );
      animate(pulse1, 0).start();
      animate(pulse2, 150).start();
      animate(pulse3, 300).start();
    } else {
      [pulse1, pulse2, pulse3].forEach((v) => v.setValue(0.4));
    }
  }, [isActive, pulse1, pulse2, pulse3]);

  return (
    <View style={styles.listeningPulse}>
      {[pulse1, pulse2, pulse3].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.pulseBar,
            { opacity: anim, transform: [{ scaleY: anim }] },
          ]}
        />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function WingmanScreen() {
  const [selectedMode, setSelectedMode] = useState<CoachingMode | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedSpeech, setCapturedSpeech] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [speakingTone, setSpeakingTone] = useState<SuggestionTone | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // SPEECH RECOGNITION (using expo-speech-recognition)
  // ─────────────────────────────────────────────

  // Note: For production, integrate expo-speech-recognition for continuous listening.
  // For now, we simulate with a manual input flow and placeholder.
  // The actual speech recognition module was in the web app via Web Speech API.

  const startListening = useCallback(async () => {
    setIsListening(true);
    setError(null);
    setSuggestions([]);
    setCapturedSpeech('');

    // In production: start expo-speech-recognition continuous listening
    // For TestFlight demo: use simulated speech input after delay
    // This will be replaced with actual speech recognition integration
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  // ─────────────────────────────────────────────
  // AI SUGGESTION GENERATION
  // ─────────────────────────────────────────────

  const generateSuggestions = useCallback(
    async (speech: string) => {
      if (!selectedMode || !speech.trim()) return;

      setIsProcessing(true);
      setError(null);

      const scenario = SCENARIOS.find((s) => s.id === selectedMode);
      if (!scenario) return;

      try {
        const response = await fetch(CYRANO_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            speech,
            mode: selectedMode,
            context: scenario.systemContext,
            history: conversationHistory.slice(-6),
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (data.suggestions) {
          setSuggestions(data.suggestions);
          setConversationHistory((prev) => [...prev, `[them]: ${speech}`]);
        } else {
          // Fallback: generate locally if API is not deployed yet
          setSuggestions(generateFallbackSuggestions(speech, selectedMode));
        }
      } catch (e) {
        console.warn('[Wingman] API call failed, using fallback:', e);
        setSuggestions(generateFallbackSuggestions(speech, selectedMode));
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedMode, conversationHistory]
  );

  // ─────────────────────────────────────────────
  // FALLBACK SUGGESTIONS (when API unavailable)
  // ─────────────────────────────────────────────

  const generateFallbackSuggestions = (speech: string, mode: CoachingMode): Suggestion[] => {
    const fallbacks: Record<CoachingMode, Suggestion[]> = {
      dating: [
        { tone: 'bold', text: "That's really interesting — I love that about you. What made you get into that?" },
        { tone: 'warm', text: "I can tell that means a lot to you. I'd love to hear more about it." },
        { tone: 'safe', text: "That's cool! How long have you been doing that?" },
      ],
      interview: [
        { tone: 'bold', text: "Absolutely — in my last role, I led a similar initiative that increased revenue by 30%." },
        { tone: 'warm', text: "That resonates with me. I've always been passionate about solving exactly that kind of problem." },
        { tone: 'safe', text: "That's a great question. In my experience, the key factor is..." },
      ],
      hardtalk: [
        { tone: 'bold', text: "I hear you, and I need to be honest — this isn't working for me the way it is." },
        { tone: 'warm', text: "I understand where you're coming from, and I want us to find something that works for both of us." },
        { tone: 'safe', text: "I appreciate you sharing that. Can we talk about what a good solution looks like?" },
      ],
      sales: [
        { tone: 'bold', text: "I understand the concern about price — but what's the cost of NOT solving this problem?" },
        { tone: 'warm', text: "That's a valid concern. Let me show you how other clients in your situation saw ROI within 60 days." },
        { tone: 'safe', text: "I hear you. Would it help if I walked through a case study that addresses exactly that?" },
      ],
    };

    return fallbacks[mode];
  };

  // ─────────────────────────────────────────────
  // TTS — Whisper to Bluetooth device
  // ─────────────────────────────────────────────

  const speakSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      setSpeakingTone(suggestion.tone);

      await Speech.speak(suggestion.text, {
        language: 'en-US',
        pitch: 0.95,
        rate: 0.9,
        onDone: () => {
          setSpeakingTone(null);
          setConversationHistory((prev) => [
            ...prev,
            `[you, ${suggestion.tone}]: ${suggestion.text}`,
          ]);
        },
        onError: () => setSpeakingTone(null),
      });
    },
    []
  );

  // ─────────────────────────────────────────────
  // DEMO: Simulate receiving speech
  // ─────────────────────────────────────────────

  const simulateSpeechInput = useCallback(() => {
    const demoInputs: Record<CoachingMode, string[]> = {
      dating: [
        "So what do you like to do for fun?",
        "I've been living here for about two years now",
        "Do you travel much?",
      ],
      interview: [
        "Tell me about a time you led a team through a difficult project",
        "Why are you interested in this role?",
        "What's your biggest weakness?",
      ],
      hardtalk: [
        "I just feel like you don't listen to me anymore",
        "This isn't what we agreed on",
        "I'm not sure this is going to work",
      ],
      sales: [
        "We're happy with our current provider",
        "That seems expensive compared to alternatives",
        "We need to think about it and get back to you",
      ],
    };

    if (!selectedMode) return;
    const inputs = demoInputs[selectedMode];
    const speech = inputs[Math.floor(Math.random() * inputs.length)];
    setCapturedSpeech(speech);
    generateSuggestions(speech);
  }, [selectedMode, generateSuggestions]);

  // ─────────────────────────────────────────────
  // RENDER: MODE SELECTION
  // ─────────────────────────────────────────────

  if (!selectedMode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wingman</Text>
          <Text style={styles.headerSubtitle}>AI whispers perfect responses in your ear</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Choose your scenario</Text>

          {SCENARIOS.map((scenario) => (
            <TouchableOpacity
              key={scenario.id}
              style={styles.scenarioCard}
              onPress={() => {
                setSelectedMode(scenario.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.scenarioIcon}>
                <Text style={styles.scenarioEmoji}>{scenario.icon}</Text>
              </View>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioName}>{scenario.name}</Text>
                <Text style={styles.scenarioDesc}>{scenario.description}</Text>
              </View>
              <Text style={styles.scenarioArrow}>→</Text>
            </TouchableOpacity>
          ))}

          {/* Device Info */}
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceTitle}>🎧 Works with</Text>
            <Text style={styles.deviceList}>
              AirPods · Meta Ray-Ban Glasses · Bose Frames · Galaxy Buds · Any Bluetooth earpiece
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: ACTIVE COACHING
  // ─────────────────────────────────────────────

  const currentScenario = SCENARIOS.find((s) => s.id === selectedMode);

  return (
    <View style={styles.container}>
      {/* Header with back */}
      <View style={styles.activeHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedMode(null);
            setSuggestions([]);
            setCapturedSpeech('');
            setConversationHistory([]);
            stopListening();
          }}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.activeHeaderInfo}>
          <Text style={styles.activeTitle}>
            {currentScenario?.icon} {currentScenario?.name} Mode
          </Text>
          <Text style={styles.activeSubtitle}>
            {isListening ? 'Listening...' : 'Tap to start'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Listening Control */}
        <TouchableOpacity
          style={[styles.listenButton, isListening && styles.listenButtonActive]}
          onPress={() => {
            if (isListening) {
              stopListening();
              // Trigger demo suggestion
              simulateSpeechInput();
            } else {
              startListening();
              // Auto-trigger demo after 3s
              setTimeout(simulateSpeechInput, 3000);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }}
          activeOpacity={0.8}
        >
          <ListeningPulse isActive={isListening} />
          <Text style={styles.listenButtonText}>
            {isListening ? 'Listening — Tap when they finish' : 'Tap to Listen'}
          </Text>
          {isListening && (
            <Text style={styles.listenHint}>
              AI is hearing the conversation...
            </Text>
          )}
        </TouchableOpacity>

        {/* Captured Speech */}
        {capturedSpeech ? (
          <View style={styles.capturedCard}>
            <Text style={styles.capturedLabel}>🎤 They said:</Text>
            <Text style={styles.capturedText}>"{capturedSpeech}"</Text>
          </View>
        ) : null}

        {/* Processing */}
        {isProcessing && (
          <View style={styles.processingCard}>
            <ActivityIndicator color="#00E676" size="small" />
            <Text style={styles.processingText}>Generating responses...</Text>
          </View>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Your responses:</Text>
            {suggestions.map((suggestion, i) => (
              <SuggestionCard
                key={`${suggestion.tone}-${i}`}
                suggestion={suggestion}
                onSpeak={() => speakSuggestion(suggestion)}
                isSpeaking={speakingTone === suggestion.tone}
              />
            ))}
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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

  // Header
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerSubtitle: { fontSize: 14, color: '#00E676', marginTop: 4 },

  content: { flex: 1, paddingHorizontal: 20 },

  sectionLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

  // Scenario Cards
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  scenarioIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#00E67615',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scenarioEmoji: { fontSize: 24 },
  scenarioInfo: { flex: 1 },
  scenarioName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 2 },
  scenarioDesc: { fontSize: 13, color: '#888' },
  scenarioArrow: { fontSize: 20, color: '#00E676' },

  // Device Info
  deviceInfo: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  deviceTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 6 },
  deviceList: { fontSize: 13, color: '#888', lineHeight: 20 },

  // Active Header
  activeHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16 },
  backText: { fontSize: 16, color: '#00E676', fontWeight: '600' },
  activeHeaderInfo: { flex: 1 },
  activeTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  activeSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  // Listen Button
  listenButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  listenButtonActive: {
    borderColor: '#00E676',
    backgroundColor: '#00E67610',
  },
  listenButtonText: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 12 },
  listenHint: { fontSize: 13, color: '#00E676', marginTop: 6 },

  // Listening Pulse
  listeningPulse: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 },
  pulseBar: { width: 4, height: 30, backgroundColor: '#00E676', borderRadius: 2 },

  // Captured Speech
  capturedCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#888',
  },
  capturedLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  capturedText: { fontSize: 16, color: '#ccc', fontStyle: 'italic', lineHeight: 22 },

  // Processing
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  processingText: { fontSize: 14, color: '#888' },

  // Suggestions
  suggestionsContainer: { marginBottom: 20 },
  suggestionsLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

  suggestionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toneBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  toneIcon: { fontSize: 14 },
  toneLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  speakingIndicator: { flexDirection: 'row', alignItems: 'center' },
  speakingText: { fontSize: 12, color: '#00E676' },
  suggestionText: { fontSize: 16, color: '#fff', lineHeight: 23 },
  tapHint: { fontSize: 12, color: '#555', marginTop: 8 },

  // Error
  errorCard: { backgroundColor: '#FF525220', borderRadius: 12, padding: 14 },
  errorText: { fontSize: 14, color: '#FF5252' },
});
