/**
 * Voxxo BLE Scanner Module - iOS Implementation
 *
 * Uses CBCentralManager for BLE central scanning.
 * Discovers nearby Voxxo users and reads their characteristics.
 *
 * @version 1.0.0
 */

import ExpoModulesCore
import CoreBluetooth

// MARK: - Constants

private let VOXLINK_SERVICE_UUID = CBUUID(string: "0000FFFF-0000-1000-8000-00805F9B34FB")
private let CHARACTERISTIC_USER_ID = CBUUID(string: "0000FF01-0000-1000-8000-00805F9B34FB")
private let CHARACTERISTIC_LANGUAGE = CBUUID(string: "0000FF02-0000-1000-8000-00805F9B34FB")
private let CHARACTERISTIC_STATUS = CBUUID(string: "0000FF03-0000-1000-8000-00805F9B34FB")
private let CHARACTERISTIC_CONNECTION_REQUEST = CBUUID(string: "0000FF04-0000-1000-8000-00805F9B34FB")

// TX Power at 1 meter for distance calculation
private let TX_POWER_1M: Double = -59.0
private let PATH_LOSS_EXPONENT: Double = 2.5
private let STALE_TIMEOUT_MS: Double = 30000

// MARK: - Scan Options

struct ScanOptions: Record {
    @Field
    var duration: Int = 0

    @Field
    var allowDuplicates: Bool = true

    @Field
    var scanMode: Int = 2
}

// MARK: - Discovered Device

struct DiscoveredDeviceData {
    var deviceId: String
    var sessionId: String
    var language: String
    var status: Int
    var rssi: Int
    var distance: Double
    var lastSeen: Double
    var peripheral: CBPeripheral?
}

// MARK: - Module

public class VoxLinkBLEScannerModule: Module {
    private var centralManager: CBCentralManager?
    private var delegate: CentralManagerDelegate?
    private var state: String = "idle"
    private var bluetoothState: String = "unknown"

    // Discovered devices
    private var discoveredDevices: [String: DiscoveredDeviceData] = [:]

    // Connected peripheral
    private var connectedPeripheral: CBPeripheral?
    private var pendingConnectionRequest: (sessionId: String, language: String, roomCode: String)?

    // Stale device cleanup timer
    private var cleanupTimer: Timer?

    public func definition() -> ModuleDefinition {
        Name("VoxLinkBLEScanner")

        Events(
            "onStateChange",
            "onBluetoothStateChange",
            "onDeviceDiscovered",
            "onDeviceLost",
            "onError"
        )

        // Check if scanning is supported
        AsyncFunction("isScanningSupported") { () -> Bool in
            return true // iOS devices support BLE scanning
        }

        // Request permissions (iOS handles this automatically via Info.plist)
        AsyncFunction("requestPermissions") { () -> Bool in
            // On iOS, Bluetooth permissions are requested automatically when
            // CBCentralManager is initialized if NSBluetoothAlwaysUsageDescription
            // is set in Info.plist
            return CBCentralManager.authorization == .allowedAlways ||
                   CBCentralManager.authorization == .notDetermined
        }

        // Get current state
        AsyncFunction("getState") { () -> String in
            return self.state
        }

        // Get Bluetooth state
        AsyncFunction("getBluetoothState") { () -> String in
            return self.bluetoothState
        }

        // Start scanning
        AsyncFunction("startScanning") { (options: ScanOptions?) in
            self.startScanningInternal(options: options)
        }

        // Stop scanning
        AsyncFunction("stopScanning") { () in
            self.stopScanningInternal()
        }

        // Connect to device
        AsyncFunction("connectToDevice") { (deviceId: String) in
            self.connectToDeviceInternal(deviceId: deviceId)
        }

        // Send connection request
        AsyncFunction("sendConnectionRequest") { (deviceId: String, sessionId: String, language: String, roomCode: String) in
            self.sendConnectionRequestInternal(deviceId: deviceId, sessionId: sessionId, language: language, roomCode: roomCode)
        }

        // Disconnect from device
        AsyncFunction("disconnectFromDevice") { (deviceId: String) in
            self.disconnectFromDeviceInternal(deviceId: deviceId)
        }
    }

    // MARK: - Private Methods

    private func startScanningInternal(options: ScanOptions?) {
        state = "starting"
        sendEvent("onStateChange", ["state": state])

        delegate = CentralManagerDelegate(module: self)
        centralManager = CBCentralManager(delegate: delegate, queue: nil)

        // Start cleanup timer
        startCleanupTimer()
    }

    private func stopScanningInternal() {
        centralManager?.stopScan()
        cleanupTimer?.invalidate()
        cleanupTimer = nil

        state = "idle"
        sendEvent("onStateChange", ["state": state])

        // Disconnect any connected peripheral
        if let peripheral = connectedPeripheral {
            centralManager?.cancelPeripheralConnection(peripheral)
            connectedPeripheral = nil
        }

        discoveredDevices.removeAll()
    }

    private func startCleanupTimer() {
        cleanupTimer?.invalidate()
        cleanupTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.cleanupStaleDevices()
        }
    }

    private func cleanupStaleDevices() {
        let now = Date().timeIntervalSince1970 * 1000

        for (deviceId, device) in discoveredDevices {
            if now - device.lastSeen > STALE_TIMEOUT_MS {
                discoveredDevices.removeValue(forKey: deviceId)
                sendEvent("onDeviceLost", ["deviceId": deviceId])
            }
        }
    }

    private func connectToDeviceInternal(deviceId: String) {
        guard let device = discoveredDevices[deviceId],
              let peripheral = device.peripheral else {
            emitError("E030", "Device not found: \(deviceId)")
            return
        }

        centralManager?.connect(peripheral, options: nil)
    }

    private func sendConnectionRequestInternal(deviceId: String, sessionId: String, language: String, roomCode: String) {
        guard let device = discoveredDevices[deviceId],
              let peripheral = device.peripheral else {
            emitError("E030", "Device not found: \(deviceId)")
            return
        }

        // Store pending request
        pendingConnectionRequest = (sessionId: sessionId, language: language, roomCode: roomCode)

        // Connect if not already connected
        if peripheral.state != .connected {
            centralManager?.connect(peripheral, options: nil)
        } else {
            writeConnectionRequest(to: peripheral)
        }
    }

    private func disconnectFromDeviceInternal(deviceId: String) {
        guard let device = discoveredDevices[deviceId],
              let peripheral = device.peripheral else {
            return
        }

        centralManager?.cancelPeripheralConnection(peripheral)
    }

    private func writeConnectionRequest(to peripheral: CBPeripheral) {
        guard let request = pendingConnectionRequest else { return }

        // Build connection request data: [16 bytes sessionId][2 bytes language][6 bytes roomCode]
        var data = Data(count: 24)

        // Session ID (16 bytes, padded)
        if let sessionData = request.sessionId.data(using: .utf8) {
            let copyLength = min(sessionData.count, 16)
            data.replaceSubrange(0..<copyLength, with: sessionData.prefix(copyLength))
        }

        // Language (2 bytes)
        if let langData = request.language.prefix(2).data(using: .utf8) {
            data.replaceSubrange(16..<18, with: langData)
        }

        // Room code (6 bytes)
        if let roomData = request.roomCode.prefix(6).data(using: .utf8) {
            data.replaceSubrange(18..<24, with: roomData)
        }

        // Find connection request characteristic and write
        if let services = peripheral.services {
            for service in services {
                if service.uuid == VOXLINK_SERVICE_UUID {
                    if let characteristics = service.characteristics {
                        for characteristic in characteristics {
                            if characteristic.uuid == CHARACTERISTIC_CONNECTION_REQUEST {
                                peripheral.writeValue(data, for: characteristic, type: .withResponse)
                                pendingConnectionRequest = nil
                                return
                            }
                        }
                    }
                }
            }
        }

        // Discover services if not found
        peripheral.discoverServices([VOXLINK_SERVICE_UUID])
    }

    // MARK: - Delegate Callbacks

    func onCentralManagerReady() {
        guard let centralManager = centralManager else { return }

        let options: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: true
        ]

        centralManager.scanForPeripherals(withServices: [VOXLINK_SERVICE_UUID], options: options)

        state = "scanning"
        sendEvent("onStateChange", ["state": state])
    }

    func onCentralManagerStateChanged(_ cbState: CBManagerState) {
        switch cbState {
        case .unknown:
            bluetoothState = "unknown"
        case .resetting:
            bluetoothState = "resetting"
        case .unsupported:
            bluetoothState = "unsupported"
            emitError("E003", "Bluetooth not supported")
        case .unauthorized:
            bluetoothState = "unauthorized"
            emitError("E002", "Bluetooth permission denied")
        case .poweredOff:
            bluetoothState = "poweredOff"
            emitError("E001", "Bluetooth is powered off")
        case .poweredOn:
            bluetoothState = "poweredOn"
            onCentralManagerReady()
        @unknown default:
            bluetoothState = "unknown"
        }

        sendEvent("onBluetoothStateChange", ["state": bluetoothState])
    }

    func onPeripheralDiscovered(_ peripheral: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
        let deviceId = peripheral.identifier.uuidString
        let rssiValue = rssi.intValue

        // Calculate distance from RSSI
        let distance = calculateDistance(rssi: rssiValue)
        let now = Date().timeIntervalSince1970 * 1000

        // Check if we already have this device
        if var existingDevice = discoveredDevices[deviceId] {
            // Update existing device
            existingDevice.rssi = rssiValue
            existingDevice.distance = distance
            existingDevice.lastSeen = now
            existingDevice.peripheral = peripheral
            discoveredDevices[deviceId] = existingDevice

            // Emit update
            sendEvent("onDeviceDiscovered", [
                "deviceId": deviceId,
                "sessionId": existingDevice.sessionId,
                "language": existingDevice.language,
                "status": existingDevice.status,
                "rssi": rssiValue,
                "distance": distance,
                "lastSeen": now
            ])
        } else {
            // New device - connect to read characteristics
            var newDevice = DiscoveredDeviceData(
                deviceId: deviceId,
                sessionId: "",
                language: "",
                status: 1,
                rssi: rssiValue,
                distance: distance,
                lastSeen: now,
                peripheral: peripheral
            )
            discoveredDevices[deviceId] = newDevice

            // Connect to read characteristics
            peripheral.delegate = delegate
            centralManager?.connect(peripheral, options: nil)
        }
    }

    func onPeripheralConnected(_ peripheral: CBPeripheral) {
        connectedPeripheral = peripheral
        peripheral.delegate = delegate
        peripheral.discoverServices([VOXLINK_SERVICE_UUID])
    }

    func onPeripheralDisconnected(_ peripheral: CBPeripheral) {
        if connectedPeripheral?.identifier == peripheral.identifier {
            connectedPeripheral = nil
        }
    }

    func onServicesDiscovered(_ peripheral: CBPeripheral) {
        guard let services = peripheral.services else { return }

        for service in services {
            if service.uuid == VOXLINK_SERVICE_UUID {
                peripheral.discoverCharacteristics([
                    CHARACTERISTIC_USER_ID,
                    CHARACTERISTIC_LANGUAGE,
                    CHARACTERISTIC_STATUS,
                    CHARACTERISTIC_CONNECTION_REQUEST
                ], for: service)
            }
        }
    }

    func onCharacteristicsDiscovered(_ peripheral: CBPeripheral, service: CBService) {
        guard let characteristics = service.characteristics else { return }

        for characteristic in characteristics {
            if characteristic.uuid == CHARACTERISTIC_USER_ID ||
               characteristic.uuid == CHARACTERISTIC_LANGUAGE ||
               characteristic.uuid == CHARACTERISTIC_STATUS {
                peripheral.readValue(for: characteristic)
            }
        }

        // If there's a pending connection request, write it
        if pendingConnectionRequest != nil {
            writeConnectionRequest(to: peripheral)
        }
    }

    func onCharacteristicRead(_ peripheral: CBPeripheral, characteristic: CBCharacteristic) {
        let deviceId = peripheral.identifier.uuidString
        guard var device = discoveredDevices[deviceId] else { return }

        if let value = characteristic.value {
            switch characteristic.uuid {
            case CHARACTERISTIC_USER_ID:
                device.sessionId = String(data: value, encoding: .utf8)?.trimmingCharacters(in: .controlCharacters) ?? ""
            case CHARACTERISTIC_LANGUAGE:
                device.language = String(data: value, encoding: .utf8) ?? ""
            case CHARACTERISTIC_STATUS:
                device.status = value.count > 0 ? Int(value[0]) : 1
            default:
                break
            }

            discoveredDevices[deviceId] = device

            // Emit device discovered event
            sendEvent("onDeviceDiscovered", [
                "deviceId": deviceId,
                "sessionId": device.sessionId,
                "language": device.language,
                "status": device.status,
                "rssi": device.rssi,
                "distance": device.distance,
                "lastSeen": device.lastSeen
            ])
        }

        // Disconnect after reading all characteristics
        // (we only need to read once, then rely on RSSI updates from scan)
        if device.sessionId != "" && device.language != "" {
            centralManager?.cancelPeripheralConnection(peripheral)
        }
    }

    private func calculateDistance(rssi: Int) -> Double {
        if rssi == 0 {
            return -1.0
        }

        let ratio = Double(rssi) / TX_POWER_1M
        if ratio < 1.0 {
            return pow(ratio, 10)
        } else {
            return 0.89976 * pow(ratio, 7.7095) + 0.111
        }
    }

    private func emitError(_ code: String, _ message: String) {
        state = "error"
        sendEvent("onStateChange", ["state": state])
        sendEvent("onError", ["code": code, "message": message])
    }
}

// MARK: - Central Manager Delegate

private class CentralManagerDelegate: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private weak var module: VoxLinkBLEScannerModule?

    init(module: VoxLinkBLEScannerModule) {
        self.module = module
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        module?.onCentralManagerStateChanged(central.state)
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        module?.onPeripheralDiscovered(peripheral, advertisementData: advertisementData, rssi: RSSI)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        module?.onPeripheralConnected(peripheral)
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        module?.onPeripheralDisconnected(peripheral)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        // Connection failed - continue scanning
    }

    // MARK: - Peripheral Delegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if error == nil {
            module?.onServicesDiscovered(peripheral)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if error == nil {
            module?.onCharacteristicsDiscovered(peripheral, service: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if error == nil {
            module?.onCharacteristicRead(peripheral, characteristic: characteristic)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        // Write complete
    }
}
