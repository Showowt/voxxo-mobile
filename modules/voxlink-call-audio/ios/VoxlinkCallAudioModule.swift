/**
 * VoxLink Call Audio Module — iOS Native Implementation
 *
 * Enables Wingman to detect phone calls, enable speaker mode,
 * and capture ambient audio for real-time AI suggestions.
 *
 * Uses:
 * - CallKit (CXCallObserver) for call detection
 * - AVAudioSession for audio routing
 * - AVAudioEngine for real-time audio capture
 * - Speech framework for on-device STT
 */

import ExpoModulesCore
import CallKit
import AVFoundation
import Speech

public class VoxlinkCallAudioModule: Module {

    // MARK: - Properties

    private let callObserver = CXCallObserver()
    private var callObserverDelegate: CallObserverDelegate?
    private var audioEngine: AVAudioEngine?
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private var isCapturing = false
    private var currentCallState: CallState = CallState()

    // MARK: - Module Definition

    public func definition() -> ModuleDefinition {
        Name("VoxlinkCallAudio")

        // Events
        Events("onCallStateChange", "onTranscription", "onAudioLevel", "onError")

        // Check if call audio features are supported
        AsyncFunction("isSupported") { () -> Bool in
            return await self.checkSupport()
        }

        // Check if a call is currently active
        AsyncFunction("isCallActive") { () -> Bool in
            return self.currentCallState.isActive
        }

        // Get current call state
        AsyncFunction("getCallState") { () -> [String: Any] in
            return self.currentCallState.toDictionary()
        }

        // Start call wingman
        AsyncFunction("startCallWingman") { (config: [String: Any]) in
            try await self.startCallWingman(config: config)
        }

        // Stop call wingman
        AsyncFunction("stopCallWingman") { () in
            self.stopCallWingman()
        }

        // Enable speaker
        AsyncFunction("enableSpeaker") { () in
            try self.enableSpeaker()
        }

        // Disable speaker
        AsyncFunction("disableSpeaker") { () in
            try self.disableSpeaker()
        }

        // Route to AirPods
        AsyncFunction("routeOutputToAirPods") { () -> Bool in
            return try self.routeToAirPods()
        }

        // Route to speaker
        AsyncFunction("routeOutputToSpeaker") { () -> Bool in
            return try self.routeToSpeaker()
        }

        // Get available output devices
        AsyncFunction("getAvailableOutputDevices") { () -> [String] in
            return self.getAvailableDevices()
        }

        // Lifecycle
        OnCreate {
            self.setupCallObserver()
        }

        OnDestroy {
            self.cleanup()
        }
    }

    // MARK: - Call Detection

    private func setupCallObserver() {
        callObserverDelegate = CallObserverDelegate { [weak self] call in
            self?.handleCallChange(call)
        }
        callObserver.setDelegate(callObserverDelegate, queue: .main)
    }

    private func handleCallChange(_ call: CXCall) {
        let wasActive = currentCallState.isActive

        currentCallState.isActive = call.hasConnected && !call.hasEnded
        currentCallState.direction = call.isOutgoing ? "outgoing" : "incoming"

        if currentCallState.isActive && !wasActive {
            // Call just connected
            sendEvent("onCallStateChange", ["state": currentCallState.toDictionary()])
        } else if !currentCallState.isActive && wasActive {
            // Call ended
            stopCapture()
            sendEvent("onCallStateChange", ["state": currentCallState.toDictionary()])
        }
    }

    // MARK: - Support Check

    private func checkSupport() async -> Bool {
        // Check speech recognition authorization
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }

        guard speechStatus == .authorized else { return false }

        // Check microphone
        let micStatus = AVAudioSession.sharedInstance().recordPermission
        guard micStatus == .granted else { return false }

        return true
    }

    // MARK: - Audio Control

    private func enableSpeaker() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
        try session.setActive(true)
        try session.overrideOutputAudioPort(.speaker)
        currentCallState.isSpeakerOn = true
    }

    private func disableSpeaker() throws {
        let session = AVAudioSession.sharedInstance()
        try session.overrideOutputAudioPort(.none)
        currentCallState.isSpeakerOn = false
    }

    private func routeToAirPods() throws -> Bool {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs

        // Look for Bluetooth headphones
        for output in outputs {
            if output.portType == .bluetoothA2DP || output.portType == .bluetoothHFP {
                return true // Already routing to Bluetooth
            }
        }

        // Try to route to Bluetooth
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])

        // Check available inputs for Bluetooth
        if let inputs = session.availableInputs {
            for input in inputs {
                if input.portType == .bluetoothHFP {
                    try session.setPreferredInput(input)
                    return true
                }
            }
        }

        return false
    }

    private func routeToSpeaker() throws -> Bool {
        let session = AVAudioSession.sharedInstance()
        try session.overrideOutputAudioPort(.speaker)
        return true
    }

    private func getAvailableDevices() -> [String] {
        var devices: [String] = ["speaker"]
        let session = AVAudioSession.sharedInstance()

        if let inputs = session.availableInputs {
            for input in inputs {
                switch input.portType {
                case .bluetoothHFP, .bluetoothA2DP:
                    if !devices.contains("airpods") {
                        devices.append("airpods")
                    }
                case .headphones:
                    if !devices.contains("headphones") {
                        devices.append("headphones")
                    }
                default:
                    break
                }
            }
        }

        return devices
    }

    // MARK: - Call Wingman

    private func startCallWingman(config: [String: Any]) async throws {
        let enableSpeaker = config["enableSpeaker"] as? Bool ?? true
        let language = config["language"] as? String ?? "en-US"

        // Setup audio session
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [
            .defaultToSpeaker,
            .allowBluetooth,
            .allowBluetoothA2DP,
            .mixWithOthers
        ])
        try session.setActive(true)

        if enableSpeaker {
            try session.overrideOutputAudioPort(.speaker)
            currentCallState.isSpeakerOn = true
        }

        // Setup speech recognition
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: language))

        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            sendEvent("onError", ["code": "SPEECH_UNAVAILABLE", "message": "Speech recognition not available"])
            return
        }

        // Start audio capture
        try startCapture()

        currentCallState.isCapturing = true
        sendEvent("onCallStateChange", ["state": currentCallState.toDictionary()])
    }

    private func stopCallWingman() {
        stopCapture()
        currentCallState.isCapturing = false
        sendEvent("onCallStateChange", ["state": currentCallState.toDictionary()])
    }

    // MARK: - Audio Capture

    private func startCapture() throws {
        guard !isCapturing else { return }

        audioEngine = AVAudioEngine()
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

        guard let audioEngine = audioEngine,
              let recognitionRequest = recognitionRequest,
              let speechRecognizer = speechRecognizer else {
            return
        }

        recognitionRequest.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        // Install tap on input node
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
            self?.processAudioLevel(buffer: buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        isCapturing = true

        // Start recognition task
        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            if let result = result {
                let transcription: [String: Any] = [
                    "text": result.bestTranscription.formattedString,
                    "isFinal": result.isFinal,
                    "confidence": result.bestTranscription.segments.last?.confidence ?? 0.0,
                    "timestamp": Date().timeIntervalSince1970
                ]
                self?.sendEvent("onTranscription", ["result": transcription])
            }

            if error != nil || result?.isFinal == true {
                // Restart recognition for continuous listening
                self?.restartRecognition()
            }
        }
    }

    private func stopCapture() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()

        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        isCapturing = false
    }

    private func restartRecognition() {
        guard isCapturing else { return }

        recognitionRequest?.endAudio()
        recognitionTask?.cancel()

        // Small delay before restarting
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self, self.isCapturing else { return }

            self.recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            self.recognitionRequest?.shouldReportPartialResults = true

            guard let recognitionRequest = self.recognitionRequest,
                  let speechRecognizer = self.speechRecognizer else { return }

            self.recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                if let result = result {
                    let transcription: [String: Any] = [
                        "text": result.bestTranscription.formattedString,
                        "isFinal": result.isFinal,
                        "confidence": result.bestTranscription.segments.last?.confidence ?? 0.0,
                        "timestamp": Date().timeIntervalSince1970
                    ]
                    self?.sendEvent("onTranscription", ["result": transcription])
                }

                if error != nil || result?.isFinal == true {
                    self?.restartRecognition()
                }
            }
        }
    }

    private func processAudioLevel(buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }

        let frameCount = Int(buffer.frameLength)
        var sum: Float = 0

        for i in 0..<frameCount {
            sum += abs(channelData[i])
        }

        let average = sum / Float(frameCount)
        let level = min(1.0, average * 10) // Normalize to 0-1

        // Detect voice activity (simple threshold)
        let isSpeaking = level > 0.02

        sendEvent("onAudioLevel", [
            "level": [
                "level": level,
                "isSpeaking": isSpeaking
            ]
        ])
    }

    // MARK: - Cleanup

    private func cleanup() {
        stopCapture()
        callObserverDelegate = nil
    }
}

// MARK: - Call State Model

private struct CallState {
    var isActive: Bool = false
    var direction: String = "unknown"
    var phoneNumber: String? = nil
    var duration: Int = 0
    var isSpeakerOn: Bool = false
    var isCapturing: Bool = false

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "isActive": isActive,
            "direction": direction,
            "duration": duration,
            "isSpeakerOn": isSpeakerOn,
            "isCapturing": isCapturing
        ]
        if let phone = phoneNumber {
            dict["phoneNumber"] = phone
        }
        return dict
    }
}

// MARK: - Call Observer Delegate

private class CallObserverDelegate: NSObject, CXCallObserverDelegate {
    private let onChange: (CXCall) -> Void

    init(onChange: @escaping (CXCall) -> Void) {
        self.onChange = onChange
    }

    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        onChange(call)
    }
}
