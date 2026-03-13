# Voxxo Call Audio Integration — Technical Architecture

## Overview

Enable Wingman AI to listen to phone calls and whisper suggestions in real-time via AirPods.

## The Challenge

| Platform | Call Audio Access | Restrictions |
|----------|------------------|--------------|
| iOS | CallKit + AVAudioEngine | Apps cannot intercept call audio directly. Must use workarounds. |
| Android | InCallService + AudioRecord | Requires special permissions. Android 11+ restricts audio capture. |

## Solution Architecture

### Strategy 1: Speaker + Ambient Capture (Works Now)
```
Phone Call (Speaker) → Device Mic → STT → Cyrano AI → TTS (AirPods)
```
**Pros**: Works on all devices, no special permissions
**Cons**: Requires speaker mode, ambient noise interference

### Strategy 2: Bluetooth Audio Routing (iOS/Android)
```
Phone Call → AirPod Left
Voxxo TTS → AirPod Right
```
**Implementation**: Audio session routing with `AVAudioSession` (iOS) / `AudioManager` (Android)

### Strategy 3: Live Transcription Integration (Best UX)
```
Phone Call → iOS Live Captions / Android Live Transcribe → OCR/Accessibility → Cyrano AI → TTS
```
**Implementation**: Accessibility Service reads live transcriptions

### Strategy 4: Call Recording + Real-time Processing (Android Only)
```
Phone Call → Call Recording API → Real-time Audio Stream → STT → Cyrano AI
```
**Note**: Only works on Android 9-10, requires system app or root on newer versions

---

## Phase 1: Enhanced Speaker Mode (Ship This Week)

### Features
1. **One-tap speaker activation** - Automatically enables speaker when Wingman starts
2. **Noise cancellation** - Filter ambient noise, isolate voice frequencies
3. **Split audio routing** - Call to speaker, Wingman to AirPods
4. **Auto-gain control** - Adjust mic sensitivity for speaker distance

### Implementation

```typescript
// lib/call-audio.ts
export class CallAudioManager {
  // Detect when user is on a call
  async detectActiveCall(): Promise<boolean>

  // Request speaker mode
  async enableSpeakerMode(): Promise<void>

  // Route TTS to specific audio output
  async routeToAirPods(): Promise<void>

  // Start ambient listening with noise cancellation
  async startEnhancedCapture(): Promise<void>
}
```

---

## Phase 2: Bluetooth Audio Split (2-3 Weeks)

### iOS Implementation (AVAudioSession)

```swift
// ios/VoxlinkCallAudioModule.swift
import AVFoundation
import CallKit

class CallAudioManager: NSObject, CXCallObserverDelegate {
    let callObserver = CXCallObserver()
    let audioEngine = AVAudioEngine()

    func setupAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord,
                               mode: .voiceChat,
                               options: [.allowBluetooth, .allowBluetoothA2DP, .mixWithOthers])
        try session.setActive(true)
    }

    // Monitor for active calls
    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        if call.hasConnected && !call.hasEnded {
            // Call is active - start listening
            startAmbientCapture()
        }
    }

    // Capture ambient audio while call plays through speaker
    func startAmbientCapture() {
        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, time in
            // Process audio buffer
            // Apply noise cancellation
            // Send to speech recognition
        }

        audioEngine.prepare()
        try audioEngine.start()
    }
}
```

### Android Implementation (Telecom + AudioManager)

```kotlin
// android/VoxlinkCallAudioModule.kt
import android.telecom.InCallService
import android.media.AudioManager
import android.media.AudioRecord

class CallAudioService : InCallService() {

    override fun onCallAdded(call: Call) {
        // Call started - prepare audio capture
        setupAudioCapture()
    }

    private fun setupAudioCapture() {
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager

        // Route call to speaker
        audioManager.isSpeakerphoneOn = true

        // Start ambient capture
        val recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            44100,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize
        )

        recorder.startRecording()
        // Stream to STT
    }
}
```

---

## Phase 3: Accessibility-Based Live Transcription (Best Quality)

### iOS: VoiceOver + Live Captions
- iOS 16+ has built-in Live Captions
- Use Accessibility API to read caption text
- Zero audio processing needed - Apple's transcription is excellent

### Android: Accessibility Service
```kotlin
class VoxxoAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            // Check if this is from Live Transcribe or Phone app
            val text = event.text.toString()
            sendToCyranoAI(text)
        }
    }
}
```

---

## Native Module Structure

```
/modules
  └── voxlink-call-audio/
      ├── expo-module.config.json
      ├── src/
      │   ├── index.ts              # TypeScript interface
      │   ├── VoxlinkCallAudio.ts   # Module class
      │   └── types.ts              # Type definitions
      ├── ios/
      │   ├── VoxlinkCallAudioModule.swift
      │   ├── CallObserver.swift
      │   └── AudioProcessor.swift
      └── android/
          ├── VoxlinkCallAudioModule.kt
          ├── CallService.kt
          └── AudioCapture.kt
```

---

## API Design

```typescript
// lib/call-audio.ts
import VoxlinkCallAudio from '../modules/voxlink-call-audio';

interface CallState {
  isActive: boolean;
  isOutgoing: boolean;
  phoneNumber?: string;
  duration: number;
}

interface CallAudioConfig {
  enableSpeaker: boolean;
  enableNoiseCancellation: boolean;
  outputDevice: 'speaker' | 'airpods' | 'auto';
  captureMode: 'ambient' | 'accessibility' | 'direct';
}

// Detect active call
VoxlinkCallAudio.isCallActive(): Promise<boolean>

// Get call state
VoxlinkCallAudio.getCallState(): Promise<CallState>

// Start wingman during call
VoxlinkCallAudio.startCallWingman(config: CallAudioConfig): Promise<void>

// Stop wingman
VoxlinkCallAudio.stopCallWingman(): Promise<void>

// Event listeners
VoxlinkCallAudio.addCallStateListener(callback: (state: CallState) => void)
VoxlinkCallAudio.addTranscriptionListener(callback: (text: string) => void)
```

---

## Permissions Required

### iOS (Info.plist)
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Voxxo needs microphone access to hear conversations and provide AI suggestions</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Voxxo uses speech recognition to understand conversations</string>

<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
    <string>voip</string>
</array>
```

### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.READ_PHONE_STATE"/>
<uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
<uses-permission android:name="android.permission.ANSWER_PHONE_CALLS"/>
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE"/>

<service
    android:name=".CallAudioService"
    android:permission="android.permission.BIND_INCALL_SERVICE">
    <intent-filter>
        <action android:name="android.telecom.InCallService"/>
    </intent-filter>
</service>
```

---

## Implementation Roadmap

### Week 1: Enhanced Speaker Mode
- [ ] Create voxlink-call-audio native module scaffold
- [ ] Implement call detection (CallKit / PhoneStateListener)
- [ ] Add speaker auto-enable on wingman start
- [ ] Integrate with existing speech recognition

### Week 2: Audio Routing
- [ ] Implement AVAudioSession routing (iOS)
- [ ] Implement AudioManager routing (Android)
- [ ] Add noise cancellation filter
- [ ] Test with AirPods Pro

### Week 3: Accessibility Integration
- [ ] iOS Live Captions reader
- [ ] Android Accessibility Service
- [ ] Combine with Cyrano AI
- [ ] End-to-end testing

---

## User Experience Flow

```
1. User gets phone call
2. User opens Voxxo → Wingman
3. Voxxo detects active call
4. Prompt: "Call detected. Enable Wingman?"
5. User taps "Yes"
6. Voxxo enables speaker (with permission)
7. Voxxo starts listening via enhanced capture
8. Other person speaks → STT → Cyrano AI
9. Suggestion whispers in user's AirPods
10. User responds with perfect thing to say
11. Call ends → Voxxo shows summary
```

---

## Competitive Moat

This feature creates an **unassailable moat**:

1. **Technical Barrier** - Native audio routing is complex
2. **Platform Knowledge** - iOS/Android audio APIs are poorly documented
3. **AI Integration** - Real-time Claude Haiku is expensive to replicate
4. **UX Polish** - Seamless call detection + whisper is hard to get right

No competitor can ship this in less than 6 months. We ship it in 3 weeks.
