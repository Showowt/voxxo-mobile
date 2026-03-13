/**
 * VoxLink Call Audio Module — Android Native Implementation
 *
 * Enables Wingman to detect phone calls, enable speaker mode,
 * and capture ambient audio for real-time AI suggestions.
 *
 * Uses:
 * - TelephonyManager for call state detection
 * - AudioManager for audio routing
 * - AudioRecord for real-time audio capture
 * - SpeechRecognizer for on-device STT
 */

package expo.modules.voxlinkcallaudio

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*

class VoxlinkCallAudioModule : Module() {

    // Coroutine scope
    private val moduleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // State
    private var isCapturing = false
    private var currentCallState = CallState()
    private var speechRecognizer: SpeechRecognizer? = null
    private var captureJob: Job? = null

    // Managers
    private val audioManager: AudioManager by lazy {
        appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    private val telephonyManager: TelephonyManager by lazy {
        appContext.reactContext?.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    }

    override fun definition() = ModuleDefinition {
        Name("VoxlinkCallAudio")

        Events("onCallStateChange", "onTranscription", "onAudioLevel", "onError")

        // Check if call audio features are supported
        AsyncFunction("isSupported") {
            checkSupport()
        }

        // Check if a call is currently active
        AsyncFunction("isCallActive") {
            currentCallState.isActive
        }

        // Get current call state
        AsyncFunction("getCallState") {
            currentCallState.toMap()
        }

        // Start call wingman
        AsyncFunction("startCallWingman") { config: Map<String, Any?> ->
            startCallWingman(config)
        }

        // Stop call wingman
        AsyncFunction("stopCallWingman") {
            stopCallWingman()
        }

        // Enable speaker
        AsyncFunction("enableSpeaker") {
            enableSpeaker()
        }

        // Disable speaker
        AsyncFunction("disableSpeaker") {
            disableSpeaker()
        }

        // Route to AirPods/Bluetooth
        AsyncFunction("routeOutputToAirPods") {
            routeToBluetoothHeadset()
        }

        // Route to speaker
        AsyncFunction("routeOutputToSpeaker") {
            routeToSpeaker()
        }

        // Get available output devices
        AsyncFunction("getAvailableOutputDevices") {
            getAvailableDevices()
        }

        OnCreate {
            setupPhoneStateListener()
        }

        OnDestroy {
            cleanup()
        }
    }

    // MARK: - Phone State Detection

    private fun setupPhoneStateListener() {
        val context = appContext.reactContext ?: return

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED) {
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+
            telephonyManager.registerTelephonyCallback(
                context.mainExecutor,
                object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) {
                        handleCallStateChange(state)
                    }
                }
            )
        } else {
            // Legacy
            @Suppress("DEPRECATION")
            telephonyManager.listen(
                object : PhoneStateListener() {
                    @Deprecated("Deprecated in API 31")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        handleCallStateChange(state, phoneNumber)
                    }
                },
                PhoneStateListener.LISTEN_CALL_STATE
            )
        }
    }

    private fun handleCallStateChange(state: Int, phoneNumber: String? = null) {
        val wasActive = currentCallState.isActive

        when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                currentCallState.isActive = true
                currentCallState.direction = "unknown" // Can't reliably detect on Android
                currentCallState.phoneNumber = phoneNumber
            }
            TelephonyManager.CALL_STATE_RINGING -> {
                currentCallState.direction = "incoming"
                currentCallState.phoneNumber = phoneNumber
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                currentCallState.isActive = false
                stopCapture()
            }
        }

        if (currentCallState.isActive != wasActive) {
            sendEvent("onCallStateChange", mapOf("state" to currentCallState.toMap()))
        }
    }

    // MARK: - Support Check

    private fun checkSupport(): Boolean {
        val context = appContext.reactContext ?: return false

        // Check mic permission
        val hasMic = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        // Check phone state permission
        val hasPhone = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        // Check speech recognition availability
        val hasSpeech = SpeechRecognizer.isRecognitionAvailable(context)

        return hasMic && hasPhone && hasSpeech
    }

    // MARK: - Audio Control

    private fun enableSpeaker(): Boolean {
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = true
        currentCallState.isSpeakerOn = true
        return true
    }

    private fun disableSpeaker(): Boolean {
        audioManager.isSpeakerphoneOn = false
        currentCallState.isSpeakerOn = false
        return true
    }

    private fun routeToBluetoothHeadset(): Boolean {
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.startBluetoothSco()
        audioManager.isBluetoothScoOn = true
        return audioManager.isBluetoothScoOn
    }

    private fun routeToSpeaker(): Boolean {
        audioManager.stopBluetoothSco()
        audioManager.isBluetoothScoOn = false
        audioManager.isSpeakerphoneOn = true
        return true
    }

    private fun getAvailableDevices(): List<String> {
        val devices = mutableListOf("speaker")

        if (audioManager.isBluetoothScoAvailableOffCall || audioManager.isBluetoothA2dpOn) {
            devices.add("airpods")
        }

        if (audioManager.isWiredHeadsetOn) {
            devices.add("headphones")
        }

        return devices
    }

    // MARK: - Call Wingman

    private fun startCallWingman(config: Map<String, Any?>) {
        val enableSpeaker = config["enableSpeaker"] as? Boolean ?: true
        val language = config["language"] as? String ?: "en-US"

        if (enableSpeaker) {
            enableSpeaker()
        }

        // Start audio capture
        startCapture(language)

        currentCallState.isCapturing = true
        sendEvent("onCallStateChange", mapOf("state" to currentCallState.toMap()))
    }

    private fun stopCallWingman() {
        stopCapture()
        currentCallState.isCapturing = false
        sendEvent("onCallStateChange", mapOf("state" to currentCallState.toMap()))
    }

    // MARK: - Audio Capture

    private fun startCapture(language: String) {
        if (isCapturing) return

        val context = appContext.reactContext ?: return

        // Initialize speech recognizer
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {
                val level = (rmsdB + 2) / 12 // Normalize roughly to 0-1
                val normalizedLevel = level.coerceIn(0f, 1f)
                sendEvent("onAudioLevel", mapOf(
                    "level" to mapOf(
                        "level" to normalizedLevel,
                        "isSpeaking" to (normalizedLevel > 0.1)
                    )
                ))
            }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}

            override fun onError(error: Int) {
                // Restart on timeout or no match
                if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                    error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                    restartRecognition(language)
                } else {
                    sendEvent("onError", mapOf(
                        "code" to "SPEECH_ERROR",
                        "message" to "Speech recognition error: $error"
                    ))
                }
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val confidences = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)

                if (!matches.isNullOrEmpty()) {
                    sendEvent("onTranscription", mapOf(
                        "result" to mapOf(
                            "text" to matches[0],
                            "isFinal" to true,
                            "confidence" to (confidences?.getOrNull(0) ?: 0.8f),
                            "timestamp" to System.currentTimeMillis()
                        )
                    ))
                }

                // Continue listening
                restartRecognition(language)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    sendEvent("onTranscription", mapOf(
                        "result" to mapOf(
                            "text" to matches[0],
                            "isFinal" to false,
                            "confidence" to 0.5f,
                            "timestamp" to System.currentTimeMillis()
                        )
                    ))
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        isCapturing = true
        startRecognition(language)
    }

    private fun startRecognition(language: String) {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        speechRecognizer?.startListening(intent)
    }

    private fun restartRecognition(language: String) {
        if (!isCapturing) return

        moduleScope.launch {
            delay(300)
            if (isCapturing) {
                startRecognition(language)
            }
        }
    }

    private fun stopCapture() {
        isCapturing = false
        speechRecognizer?.stopListening()
        speechRecognizer?.cancel()
        speechRecognizer?.destroy()
        speechRecognizer = null
        captureJob?.cancel()
    }

    // MARK: - Cleanup

    private fun cleanup() {
        stopCapture()
        moduleScope.cancel()
    }
}

// MARK: - Call State Model

data class CallState(
    var isActive: Boolean = false,
    var direction: String = "unknown",
    var phoneNumber: String? = null,
    var duration: Int = 0,
    var isSpeakerOn: Boolean = false,
    var isCapturing: Boolean = false
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "isActive" to isActive,
        "direction" to direction,
        "phoneNumber" to phoneNumber,
        "duration" to duration,
        "isSpeakerOn" to isSpeakerOn,
        "isCapturing" to isCapturing
    )
}
