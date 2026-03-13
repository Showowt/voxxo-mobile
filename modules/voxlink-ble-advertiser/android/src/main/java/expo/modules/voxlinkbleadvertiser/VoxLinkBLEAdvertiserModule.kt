/**
 * Voxxo BLE Advertiser Module - Android Implementation
 *
 * Uses BluetoothLeAdvertiser for BLE peripheral advertising.
 *
 * @version 1.0.0
 */

package expo.modules.voxlinkbleadvertiser

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.*

// Constants
private val VOXLINK_SERVICE_UUID = UUID.fromString("0000FFFF-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_USER_ID = UUID.fromString("0000FF01-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_LANGUAGE = UUID.fromString("0000FF02-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_STATUS = UUID.fromString("0000FF03-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_CONNECTION_REQUEST = UUID.fromString("0000FF04-0000-1000-8000-00805F9B34FB")

// Data class for advertising data
class AdvertiseData : Record {
    @Field
    var sessionId: String = ""

    @Field
    var language: String = "en"

    @Field
    var status: Int = 0x01
}

class VoxLinkBLEAdvertiserModule : Module() {
    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeAdvertiser: BluetoothLeAdvertiser? = null
    private var gattServer: BluetoothGattServer? = null
    private var currentData: AdvertiseData? = null
    private var state: String = "idle"

    // Characteristics
    private var userIdCharacteristic: BluetoothGattCharacteristic? = null
    private var languageCharacteristic: BluetoothGattCharacteristic? = null
    private var statusCharacteristic: BluetoothGattCharacteristic? = null
    private var connectionRequestCharacteristic: BluetoothGattCharacteristic? = null

    override fun definition() = ModuleDefinition {
        Name("VoxLinkBLEAdvertiser")

        Events("onStateChange", "onConnectionRequest", "onError")

        // Check if advertising is supported
        AsyncFunction("isAdvertisingSupported") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bluetoothManager?.adapter
            return@AsyncFunction adapter?.bluetoothLeAdvertiser != null
        }

        // Get current state
        AsyncFunction("getState") {
            return@AsyncFunction state
        }

        // Start advertising
        AsyncFunction("startAdvertising") { data: AdvertiseData ->
            currentData = data
            startAdvertisingInternal()
        }

        // Stop advertising
        AsyncFunction("stopAdvertising") {
            stopAdvertisingInternal()
        }

        // Update advertising data
        AsyncFunction("updateAdvertiseData") { data: AdvertiseData ->
            currentData?.let { current ->
                if (data.sessionId.isNotEmpty()) {
                    current.sessionId = data.sessionId
                }
                if (data.language.isNotEmpty()) {
                    current.language = data.language
                }
                if (data.status != 0) {
                    current.status = data.status
                }
                updateCharacteristics()
            }
        }
    }

    private fun startAdvertisingInternal() {
        val context = appContext.reactContext ?: run {
            emitError("E010", "Context not available")
            return
        }

        state = "starting"
        sendEvent("onStateChange", mapOf("state" to state))

        // Check permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
                emitError("E002", "Bluetooth advertise permission denied")
                return
            }
        }

        // Get Bluetooth adapter
        bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter

        if (bluetoothAdapter == null || !bluetoothAdapter!!.isEnabled) {
            emitError("E001", "Bluetooth is not enabled")
            return
        }

        bluetoothLeAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
        if (bluetoothLeAdvertiser == null) {
            emitError("E003", "BLE advertising not supported")
            return
        }

        // Setup GATT server
        setupGattServer(context)

        // Start advertising
        startBleAdvertising()
    }

    private fun setupGattServer(context: Context) {
        try {
            gattServer = bluetoothManager?.openGattServer(context, gattServerCallback)

            // Create service
            val service = BluetoothGattService(
                VOXLINK_SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )

            // User ID characteristic (read)
            userIdCharacteristic = BluetoothGattCharacteristic(
                CHARACTERISTIC_USER_ID,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ
            )

            // Language characteristic (read)
            languageCharacteristic = BluetoothGattCharacteristic(
                CHARACTERISTIC_LANGUAGE,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ
            )

            // Status characteristic (read)
            statusCharacteristic = BluetoothGattCharacteristic(
                CHARACTERISTIC_STATUS,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ
            )

            // Connection request characteristic (write)
            connectionRequestCharacteristic = BluetoothGattCharacteristic(
                CHARACTERISTIC_CONNECTION_REQUEST,
                BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
            )

            // Add characteristics to service
            service.addCharacteristic(userIdCharacteristic)
            service.addCharacteristic(languageCharacteristic)
            service.addCharacteristic(statusCharacteristic)
            service.addCharacteristic(connectionRequestCharacteristic)

            // Add service to GATT server
            gattServer?.addService(service)

            // Set initial values
            updateCharacteristics()
        } catch (e: SecurityException) {
            emitError("E002", "Bluetooth permission denied: ${e.message}")
        }
    }

    private fun updateCharacteristics() {
        currentData?.let { data ->
            // Update User ID (16 bytes)
            val sessionBytes = data.sessionId.toByteArray(Charsets.UTF_8)
            val paddedSession = ByteArray(16)
            System.arraycopy(sessionBytes, 0, paddedSession, 0, minOf(sessionBytes.size, 16))
            userIdCharacteristic?.value = paddedSession

            // Update Language (2 bytes)
            val langBytes = data.language.take(2).toByteArray(Charsets.UTF_8)
            languageCharacteristic?.value = langBytes

            // Update Status (1 byte)
            statusCharacteristic?.value = byteArrayOf(data.status.toByte())
        }
    }

    private fun startBleAdvertising() {
        try {
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .build()

            val advertiseData = android.bluetooth.le.AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceUuid(ParcelUuid(VOXLINK_SERVICE_UUID))
                .build()

            val scanResponse = android.bluetooth.le.AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .build()

            bluetoothLeAdvertiser?.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
        } catch (e: SecurityException) {
            emitError("E002", "Bluetooth permission denied: ${e.message}")
        }
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            state = "advertising"
            sendEvent("onStateChange", mapOf("state" to state))
        }

        override fun onStartFailure(errorCode: Int) {
            state = "error"
            sendEvent("onStateChange", mapOf("state" to state))

            val errorMessage = when (errorCode) {
                ADVERTISE_FAILED_DATA_TOO_LARGE -> "Advertise data too large"
                ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
                ADVERTISE_FAILED_ALREADY_STARTED -> "Already advertising"
                ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
                ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
                else -> "Unknown error: $errorCode"
            }
            emitError("E021", errorMessage)
        }
    }

    private val gattServerCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
            // Connection state changed
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice?,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic?
        ) {
            try {
                val value = characteristic?.value ?: ByteArray(0)
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
            } catch (e: SecurityException) {
                emitError("E002", "Permission denied: ${e.message}")
            }
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice?,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic?,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            try {
                // Handle connection request
                if (characteristic?.uuid == CHARACTERISTIC_CONNECTION_REQUEST && value != null && value.size >= 24) {
                    val sessionId = String(value.copyOfRange(0, 16), Charsets.UTF_8).trim('\u0000')
                    val language = String(value.copyOfRange(16, 18), Charsets.UTF_8)
                    val roomCode = String(value.copyOfRange(18, 24), Charsets.UTF_8)

                    sendEvent("onConnectionRequest", mapOf(
                        "fromSessionId" to sessionId,
                        "fromLanguage" to language,
                        "roomCode" to roomCode
                    ))
                }

                if (responseNeeded) {
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
                }
            } catch (e: SecurityException) {
                emitError("E002", "Permission denied: ${e.message}")
            }
        }
    }

    private fun stopAdvertisingInternal() {
        try {
            bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
            gattServer?.clearServices()
            gattServer?.close()
        } catch (e: SecurityException) {
            // Ignore permission errors during cleanup
        }

        bluetoothLeAdvertiser = null
        gattServer = null
        currentData = null
        state = "idle"
        sendEvent("onStateChange", mapOf("state" to state))
    }

    private fun emitError(code: String, message: String) {
        state = "error"
        sendEvent("onStateChange", mapOf("state" to state))
        sendEvent("onError", mapOf("code" to code, "message" to message))
    }
}
