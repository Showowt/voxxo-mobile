/**
 * Face-to-Face Screen — One Phone, Two People
 * 
 * Host generates a link → Guest opens in browser → bidirectional translation
 * No app download required for guest
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { translate, LANGUAGES, type Language } from '../services/translation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Phase = 'setup' | 'active';
type Speaker = 'host' | 'guest';

interface Message {
  id: string;
  speaker: Speaker;
  originalText: string;
  translatedText: string;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM CODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubble({ message, isHost }: { message: Message; isHost: boolean }) {
  const isMe = message.speaker === (isHost ? 'host' : 'guest');

  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      <Text style={styles.bubbleSpeaker}>
        {isMe ? '🟢 You' : '🔵 Guest'}
      </Text>
      <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
        {message.translatedText}
      </Text>
      <Text style={styles.bubbleOriginal}>
        {message.originalText}
      </Text>
      <Text style={styles.bubbleTime}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FaceToFaceScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [hostLang, setHostLang] = useState(LANGUAGES[0]); // English
  const [guestLang, setGuestLang] = useState(LANGUAGES[1]); // Spanish
  const [roomCode] = useState(generateRoomCode());
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('host');
  const [showLangPicker, setShowLangPicker] = useState<'host' | 'guest' | null>(null);

  const shareLink = `https://entrevoz.co/f2f/${roomCode}`;

  // ─────────────────────────────────────────────
  // SHARE LINK
  // ─────────────────────────────────────────────

  const handleShareLink = async () => {
    await Share.share({
      message: `Join my Entrevoz conversation: ${shareLink}`,
      url: shareLink,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ─────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isTranslating) return;

    setIsTranslating(true);
    const fromLang = activeSpeaker === 'host' ? hostLang : guestLang;
    const toLang = activeSpeaker === 'host' ? guestLang : hostLang;

    try {
      const result = await translate(inputText, fromLang.code, toLang.code);

      const newMessage: Message = {
        id: Date.now().toString(),
        speaker: activeSpeaker,
        originalText: inputText,
        translatedText: result.translatedText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newMessage]);
      setInputText('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.error('[F2F] Translation error:', e);
    } finally {
      setIsTranslating(false);
    }
  }, [inputText, activeSpeaker, hostLang, guestLang, isTranslating]);

  // ─────────────────────────────────────────────
  // LANGUAGE PICKER
  // ─────────────────────────────────────────────

  if (showLangPicker) {
    const isHost = showLangPicker === 'host';
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setShowLangPicker(null)}>
            <Text style={styles.pickerBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>
            {isHost ? 'I speak' : 'They speak'}
          </Text>
        </View>
        <ScrollView style={styles.content}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.pickerOption,
                (isHost ? hostLang : guestLang).code === lang.code && styles.pickerOptionActive,
              ]}
              onPress={() => {
                if (isHost) setHostLang(lang);
                else setGuestLang(lang);
                setShowLangPicker(null);
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
  // SETUP PHASE
  // ─────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Face-to-Face</Text>
          <Text style={styles.headerSubtitle}>One phone. Two languages. Zero friction.</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Globe Icon */}
          <View style={styles.globeContainer}>
            <Text style={styles.globe}>🌍</Text>
          </View>

          {/* Language Selection */}
          <View style={styles.langSetup}>
            <TouchableOpacity
              style={styles.langSetupButton}
              onPress={() => setShowLangPicker('host')}
            >
              <Text style={styles.langSetupLabel}>I speak</Text>
              <View style={styles.langSetupValue}>
                <Text style={styles.langSetupFlag}>{hostLang.flag}</Text>
                <Text style={styles.langSetupName}>{hostLang.name}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.langSetupDivider}>
              <Text style={styles.langSetupArrow}>⇄</Text>
            </View>

            <TouchableOpacity
              style={styles.langSetupButton}
              onPress={() => setShowLangPicker('guest')}
            >
              <Text style={styles.langSetupLabel}>They speak</Text>
              <View style={styles.langSetupValue}>
                <Text style={styles.langSetupFlag}>{guestLang.flag}</Text>
                <Text style={styles.langSetupName}>{guestLang.name}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Share Link Card */}
          <View style={styles.linkCard}>
            <Text style={styles.linkTitle}>Share this link with them</Text>
            <Text style={styles.linkSubtitle}>No app download needed — opens in browser</Text>

            <View style={styles.linkDisplay}>
              <Text style={styles.linkText} numberOfLines={1}>{shareLink}</Text>
            </View>

            <View style={styles.linkActions}>
              <TouchableOpacity style={styles.linkActionShare} onPress={handleShareLink}>
                <Text style={styles.linkActionShareText}>Share Link 🔗</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkActionCopy} onPress={handleCopyLink}>
                <Text style={styles.linkActionCopyText}>Copy</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.roomCodeLabel}>Room: {roomCode}</Text>
          </View>

          {/* Start Button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              setPhase('active');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start Conversation</Text>
          </TouchableOpacity>

          {/* Features */}
          <View style={styles.features}>
            {[
              { icon: '📱', text: 'No app download required for guest' },
              { icon: '🌐', text: 'Works anywhere in the world' },
              { icon: '🔤', text: '30+ languages supported' },
              { icon: '⚡', text: 'Real-time voice translation' },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // ACTIVE CONVERSATION
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Conversation Header */}
      <View style={styles.convHeader}>
        <TouchableOpacity onPress={() => setPhase('setup')}>
          <Text style={styles.convBack}>← End</Text>
        </TouchableOpacity>
        <View style={styles.convHeaderCenter}>
          <Text style={styles.convTitle}>
            {hostLang.flag} ⇄ {guestLang.flag}
          </Text>
          <Text style={styles.convRoom}>Room: {roomCode}</Text>
        </View>
      </View>

      {/* Speaker Toggle */}
      <View style={styles.speakerToggle}>
        <TouchableOpacity
          style={[styles.speakerButton, activeSpeaker === 'host' && styles.speakerButtonActive]}
          onPress={() => setActiveSpeaker('host')}
        >
          <Text style={styles.speakerFlag}>{hostLang.flag}</Text>
          <Text style={[styles.speakerLabel, activeSpeaker === 'host' && styles.speakerLabelActive]}>
            You ({hostLang.name})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.speakerButton, activeSpeaker === 'guest' && styles.speakerButtonActive]}
          onPress={() => setActiveSpeaker('guest')}
        >
          <Text style={styles.speakerFlag}>{guestLang.flag}</Text>
          <Text style={[styles.speakerLabel, activeSpeaker === 'guest' && styles.speakerLabelActive]}>
            Guest ({guestLang.name})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyConv}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>Start speaking — your words appear translated</Text>
          </View>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isHost />
          ))
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <View style={styles.inputSpeakerIndicator}>
          <Text style={styles.inputSpeakerFlag}>
            {activeSpeaker === 'host' ? hostLang.flag : guestLang.flag}
          </Text>
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={`Type in ${activeSpeaker === 'host' ? hostLang.name : guestLang.name}...`}
          placeholderTextColor="#555"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isTranslating) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isTranslating}
        >
          {isTranslating ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
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
  headerSubtitle: { fontSize: 14, color: '#00E676', marginTop: 4 },

  content: { flex: 1, paddingHorizontal: 20 },

  // Globe
  globeContainer: { alignItems: 'center', marginVertical: 20 },
  globe: { fontSize: 60 },

  // Language Setup
  langSetup: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  langSetupButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  langSetupLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  langSetupValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langSetupFlag: { fontSize: 22 },
  langSetupName: { fontSize: 16, color: '#fff', fontWeight: '600' },
  langSetupDivider: { paddingHorizontal: 10 },
  langSetupArrow: { fontSize: 20, color: '#00E676' },

  // Link Card
  linkCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#00E67630',
  },
  linkTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 4 },
  linkSubtitle: { fontSize: 13, color: '#888', marginBottom: 14 },
  linkDisplay: { backgroundColor: '#0A0A0A', borderRadius: 10, padding: 12, marginBottom: 12 },
  linkText: { fontSize: 13, color: '#00E676', fontFamily: 'monospace' },
  linkActions: { flexDirection: 'row', gap: 10 },
  linkActionShare: { flex: 2, backgroundColor: '#00E676', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  linkActionShareText: { fontSize: 16, fontWeight: '700', color: '#000' },
  linkActionCopy: { flex: 1, backgroundColor: '#2A2A2A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  linkActionCopyText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  roomCodeLabel: { fontSize: 12, color: '#555', marginTop: 12, textAlign: 'center' },

  // Start Button
  startButton: { backgroundColor: '#00E676', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 24 },
  startButtonText: { fontSize: 18, fontWeight: '800', color: '#000' },

  // Features
  features: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 18 },
  featureText: { fontSize: 14, color: '#888' },

  // Conversation Header
  convHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  convBack: { fontSize: 16, color: '#FF5252', fontWeight: '600', marginRight: 16 },
  convHeaderCenter: { flex: 1 },
  convTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  convRoom: { fontSize: 12, color: '#555' },

  // Speaker Toggle
  speakerToggle: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  speakerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  speakerButtonActive: { borderColor: '#00E676', backgroundColor: '#00E67610' },
  speakerFlag: { fontSize: 18 },
  speakerLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  speakerLabelActive: { color: '#00E676' },

  // Messages
  messagesContainer: { flex: 1, paddingHorizontal: 20 },
  emptyConv: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#555', textAlign: 'center' },

  bubble: { maxWidth: '85%', borderRadius: 16, padding: 14, marginBottom: 10 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#00E67620', borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#1A1A1A', borderBottomLeftRadius: 4 },
  bubbleSpeaker: { fontSize: 11, color: '#888', marginBottom: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMe: { color: '#00E676' },
  bubbleTextThem: { color: '#fff' },
  bubbleOriginal: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  bubbleTime: { fontSize: 10, color: '#444', marginTop: 4, textAlign: 'right' },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 34,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 8,
  },
  inputSpeakerIndicator: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  inputSpeakerFlag: { fontSize: 18 },
  inputField: { flex: 1, fontSize: 16, color: '#fff', paddingVertical: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00E676', alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.3 },
  sendButtonText: { fontSize: 20, fontWeight: '700', color: '#000' },

  // Language Picker
  pickerHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  pickerBack: { fontSize: 16, color: '#00E676', fontWeight: '600' },
  pickerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 12 },
  pickerOptionActive: { backgroundColor: '#00E67610' },
  pickerFlag: { fontSize: 24 },
  pickerName: { fontSize: 16, color: '#fff', flex: 1 },
  pickerNative: { fontSize: 14, color: '#888' },
});
