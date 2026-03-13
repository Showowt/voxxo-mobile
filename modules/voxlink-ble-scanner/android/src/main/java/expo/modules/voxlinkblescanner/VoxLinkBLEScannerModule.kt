/**
 * Voxxo BLE Scanner Module - Android Implementation
 *
 * Uses BluetoothLeScanner for BLE central scanning.
 * Discovers nearby Voxxo users and reads their characteristics.
 *
 * @version 1.0.0
 */

package expo.modules.voxlinkblescanner

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.*
import kotlin.math.pow

// Constants
private val VOXLINK_SERVICE_UUID = UUID.fromString("0000FFFF-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_USER_ID = UUID.fromString("0000FF01-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_LANGUAGE = UUID.fromString("0000FF02-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_STATUS = UUID.fromString("0000FF03-0000-1000-8000-00805F9B34FB")
private val CHARACTERISTIC_CONNECTION_REQUEST = UUID.fromString("0000FF04-0000-1000-8000-00805F9B34FB")

// Distance calculation constants
private const val TX_POWER_1M = -59.0
private const val PATH_LOSS_EXPONENT = 2.5
private const val STALE_TIMEOUT_MS = 30000L

// Scan options record
class ScanOptions : Record {
    @Field
    var duration: Int = 0

    @Field
    var allowDuplicates: Boolean = true

    @Field
    var scanMode: Int = 2
}

// Discovered device data
data class DiscoveredDeviceData(
    var deviceId: String,
    var sessionId: String,
    var language: String,
    var status: Int,
    var rssi: Int,
    var distance: Double,
    var lastSeen: Long,
    var device: BluetoothDevice? = null
)

class VoxLinkBLEScannerModule : Module() {
    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var state: String = "idle"
    private var bluetoothState: String = "unknown"

    // Discovered devices
    private val discoveredDevices = mutableMapOf<String, DiscoveredDeviceData>()

    // Connected GATT
    private var connectedGatt: BluetoothGatt? = null
    private var pendingConnectionRequest: Triple<String, String, String>? = null

    // Handler for cleanup timer
    private val handler = Handler(Looper.getMainLooper())
    private val cleanupRunnable = object : Runnable {
        override fun run() {
            cleanupStaleDevices()
            handler.postDelayed(this, 5000)
        }
    }

    override fun definition() = ModuleDefinition {
        Name("VoxLinkBLEScanner")

        Events(
            "onStateChange",
            "onBluetoothStateChange",
            "onDeviceDiscovered",
            "onDeviceLost",
            "onError"
        )

        // Check if scanning is supported
        AsyncFunction("isScanningSupported") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bluetoothManager?.adapter
            return@AsyncFunction adapter?.bluetoothLeScanner != null
        }

        // Request permissions
        AsyncFunction("requestPermissions") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            return@AsyncFunction checkPermissions(context)
        }

        // Get current state
        AsyncFunction("getState") {
            return@AsyncFunction state
        }

        // Get Bluetooth state
        AsyncFunction("getBluetoothState") {
            return@AsyncFunction bluetoothState
        }

        // Start scanning
        AsyncFunction("startScanning") { options: ScanOptions? ->
            startScanningInternal(options)
        }

        // Stop scanning
        AsyncFunction("stopScanning") {
            stopScanningInternal()
        }

        // Connect to device
        AsyncFunction("connectToDevice") { deviceId: String ->
            connectToDeviceInternal(deviceId)
        }

        // Send connection request
        AsyncFunction("sendConnectionRequest") { deviceId: String, sessionId: String, language: String, roomCode: String ->
            sendConnectionRequestInternal(deviceId, sessionId, language, roomCode)
        }

        // Disconnect from device
        AsyncFunction("disconnectFromDevice") { deviceId: String ->
            disconnectFromDeviceInternal(deviceId)
        }
    }

    private fun checkPermissions(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                   ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun startScanningInternal(options: ScanOptions?) {
        val context = appContext.reactContext ?: run {
            emitError("E010", "Context not available")
            return
        }

        state = "starting"
        sendEvent("onStateChange", mapOf("state" to state))

        // Check permissions
        if (!checkPermissions(context)) {
            emitError("E002", "Bluetooth scan permission denied")
            return
        }

        // Get Bluetooth adapter
        bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter

        if (bluetoothAdapter == null) {
            bluetoothState = "unsupported"
            sendEvent("onBluetoothStateChange", mapOf("state" to bluetoothState))
            emitError("E003", "Bluetooth not supported")
            return
        }

        if (!bluetoothAdapter!!.isEnabled) {
            bluetoothState = "poweredOff"
            sendEvent("onBluetoothStateChange", mapOf("state" to bluetoothState))
            emitError("E001", "Bluetooth is not enabled")
            return
        }

        bluetoothState = "poweredOn"
        sendEvent("onBluetoothStateChange", mapOf("state" to bluetoothState))

        bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
        if (bluetoothLeScanner == null) {
            emitError("E003", "BLE scanning not supported")
            return
        }

        // Start scanning
        startBleScanning(options)

        // Start cleanup timer
        handler.postDelayed(cleanupRunnable, 5000)
    }

    private fun startBleScanning(options: ScanOptions?) {
        try {
            val scanMode = when (options?.scanMode ?: 2) {
                0 -> ScanSettings.SCAN_MODE_LOW_POWER
                1 -> ScanSettings.SCAN_MODE_BALANCED
                else -> ScanSettings.SCAN_MODE_LOW_LATENCY
            }

            val settings = ScanSettings.Builder()
                .setScanMode(scanMode)
                .setReportDelay(0)
                .build()

            val filter = ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(VOXLINK_SERVICE_UUID))
                .build()

            bluetoothLeScanner?.startScan(listOf(filter), settings, scanCallback)

            state = "scanning"
            sendEvent("onStateChange", mapOf("state" to state))
        } catch (e: SecurityException) {
            emitError("E002", "Bluetooth permission denied: ${e.message}")
        }
    }

    private fun stopScanningInternal() {
        try {
            bluetoothLeScanner?.stopScan(scanCallback)
        } catch (e: SecurityException) {
            // Ignore permission errors during cleanup
        }

        handler.removeCallbacks(cleanupRunnable)

        // Disconnect any connected GATT
        try {
            connectedGatt?.close()
        } catch (e: SecurityException) {
            // Ignore
        }
        connectedGatt = null

        discoveredDevices.clear()
        state = "idle"
        sendEvent("onStateChange", mapOf("state" to state))
    }

    private fun cleanupStaleDevices() {
        val now = System.currentTimeMillis()
        val staleDevices = discoveredDevices.filter { now - it.value.lastSeen > STALE_TIMEOUT_MS }

        staleDevices.forEach { (deviceId, _) ->
            discoveredDevices.remove(deviceId)
            sendEvent("onDeviceLost", mapOf("deviceId" to deviceId))
        }
    }

    private fun connectToDeviceInternal(deviceId: String) {
        val device = discoveredDevices[deviceId]?.device ?: run {
            emitError("E030", "Device not found: $deviceId")
            return
        }

        try {
            val context = appContext.reactContext ?: return
            connectedGatt = device.connectGatt(context, false, gattCallback)
        } catch (e: SecurityException) {
            emitError("E002", "Bluetooth permission denied: ${e.message}")
        }
    }

    private fun sendConnectionRequestInternal(deviceId: String, sessionId: String, language: String, roomCode: String) {
        val device = discoveredDevices[deviceId]?.device ?: run {
            emitError("E030", "Device not found: $deviceId")
            return
        }

        // Store pending request
        pendingConnectionRequest = Triple(sessionId, language, roomCode)

        // Connect if not already connected
        if (connectedGatt == null) {
            try {
                val context = appContext.reactContext ?: return
                connectedGatt = device.connectGatt(context, false, gattCallback)
            } catch (e: SecurityException) {
                emitError("E002", "Bluetooth permission denied: ${e.message}")
            }
        } else {
            writeConnectionRequest()
        }
    }

    private fun disconnectFromDeviceInternal(deviceId: String) {
        try {
            connectedGatt?.disconnect()
            connectedGatt?.close()
        } catch (e: SecurityException) {
            // Ignore
        }
        connectedGatt = null
    }

    private fun writeConnectionRequest() {
        val request = pendingConnectionRequest ?: return
        val gatt = connectedGatt ?: return

        // Build connection request data: [16 bytes sessionId][2 bytes language][6 bytes roomCode]
        val data = ByteArray(24)

        // Session ID (16 bytes, padded)
        val sessionBytes = request.first.toByteArray(Charsets.UTF_8)
        System.arraycopy(sessionBytes, 0, data, 0, minOf(sessionBytes.size, 16))

        // Language (2 bytes)
        val langBytes = request.second.take(2).toByteArray(Charsets.UTF_8)
        System.arraycopy(langBytes, 0, data, 16, minOf(langBytes.size, 2))

        // Room code (6 bytes)
        val roomBytes = request.third.take(6).toByteArray(Charsets.UTF_8)
        System.arraycopy(roomBytes, 0, data, 18, minOf(roomBytes.size, 6))

        // Find connection request characteristic and write
        try {
            gatt.services?.forEach { service ->
                if (service.uuid == VOXLINK_SERVICE_UUID) {
                    service.characteristics?.forEach { characteristic ->
                        if (characteristic.uuid == CHARACTERISTIC_CONNECTION_REQUEST) {
                            characteristic.value = data
                            gatt.writeCharacteristic(characteristic)
                            pendingConnectionRequest = null
                            return
                        }
                    }
                }
            }
        } catch (e: SecurityException) {
            emitError("E002", "Bluetooth permission denied: ${e.message}")
        }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result?.let { processDiscoveredDevice(it) }
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>?) {
            results?.forEach { processDiscoveredDevice(it) }
        }

        override fun onScanFailed(errorCode: Int) {
            val errorMessage = when (errorCode) {
                SCAN_FAILED_ALREADY_STARTED -> "Scan already started"
                SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "App registration failed"
                SCAN_FAILED_INTERNAL_ERROR -> "Internal error"
                SCAN_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
                else -> "Unknown error: $errorCode"
            }
            emitError("E010", errorMessage)
        }
    }

    private fun processDiscoveredDevice(result: ScanResult) {
        val device = result.device
        val deviceId = device.address
        val rssi = result.rssi
        val distance = calculateDistance(rssi)
        val now = System.currentTimeMillis()

        // Check if we already have this device
        val existingDevice = discoveredDevices[deviceId]
        if (existingDevice != null) {
            // Update existing device
            existingDevice.rssi = rssi
            existingDevice.distance = distance
            existingDevice.lastSeen = now
            existingDevice.device = device

            // Emit update
            sendEvent("onDeviceDiscovered", mapOf(
                "deviceId" to deviceId,
                "sessionId" to existingDevice.sessionId,
                "language" to existingDevice.language,
                "status" to existingDevice.status,
                "rssi" to rssi,
                "distance" to distance,
                "lastSeen" to now
            ))
        } else {
            // New device - add and connect to read characteristics
            val newDevice = DiscoveredDeviceData(
                deviceId = deviceId,
                sessionId = "",
                language = "",
                status = 1,
                rssi = rssi,
                distance = distance,
                lastSeen = now,
                device = device
            )
            discoveredDevices[deviceId] = newDevice

            // Connect to read characteristics
            try {
                val context = appContext.reactContext ?: return
                connectedGatt = device.connectGatt(context, false, gattCallback)
            } catch (e: SecurityException) {
                // Emit device with minimal info
                sendEvent("onDeviceDiscovered", mapOf(
                    "deviceId" to deviceId,
                    "sessionId" to "",
                    "language" to "",
                    "status" to 1,
                    "rssi" to rssi,
                    "distance" to distance,
                    "lastSeen" to now
                ))
            }
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                try {
                    gatt?.discoverServices()
                } catch (e: SecurityException) {
                    emitError("E002", "Permission denied: ${e.message}")
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                try {
                    gatt?.close()
                } catch (e: SecurityException) {
                    // Ignore
                }
                if (connectedGatt == gatt) {
                    connectedGatt = null
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                try {
                    gatt?.services?.forEach { service ->
                        if (service.uuid == VOXLINK_SERVICE_UUID) {
                            service.characteristics?.forEach { characteristic ->
                                when (characteristic.uuid) {
                                    CHARACTERISTIC_USER_ID,
                                    CHARACTERISTIC_LANGUAGE,
                                    CHARACTERISTIC_STATUS -> {
                                        gatt.readCharacteristic(characteristic)
                                    }
                                }
                            }
                        }
                    }
                } catch (e: SecurityException) {
                    emitError("E002", "Permission denied: ${e.message}")
                }

                // If there's a pending connection request, write it
                if (pendingConnectionRequest != null) {
                    handler.postDelayed({ writeConnectionRequest() }, 500)
                }
            }
        }

        override fun onCharacteristicRead(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic?, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS && characteristic != null) {
                val deviceId = gatt?.device?.address ?: return
                val device = discoveredDevices[deviceId] ?: return
                val value = characteristic.value ?: return

                when (characteristic.uuid) {
                    CHARACTERISTIC_USER_ID -> {
                        device.sessionId = String(value, Charsets.UTF_8).trim('\u0000')
                    }
                    CHARACTERISTIC_LANGUAGE -> {
                        device.language = String(value, Charsets.UTF_8)
                    }
                    CHARACTERISTIC_STATUS -> {
                        device.status = if (value.isNotEmpty()) value[0].toInt() and 0xFF else 1
                    }
                }

                // Emit updated device
                sendEvent("onDeviceDiscovered", mapOf(
                    "deviceId" to deviceId,
                    "sessionId" to device.sessionId,
                    "language" to device.language,
                    "status" to device.status,
                    "rssi" to device.rssi,
                    "distance" to device.distance,
                    "lastSeen" to device.lastSeen
                ))

                // Disconnect after reading all characteristics
                if (device.sessionId.isNotEmpty() && device.language.isNotEmpty()) {
                    try {
                        gatt.disconnect()
                    } catch (e: SecurityException) {
                        // Ignore
                    }
                }
            }
        }

        override fun onCharacteristicWrite(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic?, status: Int) {
            // Write complete
        }
    }

    private fun calculateDistance(rssi: Int): Double {
        if (rssi == 0) {
            return -1.0
        }

        val ratio = rssi.toDouble() / TX_POWER_1M
        return if (ratio < 1.0) {
            ratio.pow(10.0)
        } else {
            0.89976 * ratio.pow(7.7095) + 0.111
        }
    }

    private fun emitError(code: String, message: String) {
        state = "error"
        sendEvent("onStateChange", mapOf("state" to state))
        sendEvent("onError", mapOf("code" to code, "message" to message))
    }
}
