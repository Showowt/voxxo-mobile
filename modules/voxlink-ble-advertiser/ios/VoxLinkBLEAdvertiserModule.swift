/**
 * Voxxo BLE Advertiser Module - iOS Implementation
 *
 * Uses CBPeripheralManager for BLE peripheral advertising.
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

// MARK: - Advertise Data

struct AdvertiseData: Record {
    @Field
    var sessionId: String = ""

    @Field
    var language: String = "en"

    @Field
    var status: Int = 0x01
}

// MARK: - Module

public class VoxLinkBLEAdvertiserModule: Module {
    private var peripheralManager: CBPeripheralManager?
    private var delegate: PeripheralManagerDelegate?
    private var service: CBMutableService?
    private var currentData: AdvertiseData?
    private var state: String = "idle"

    // Characteristics
    private var userIdCharacteristic: CBMutableCharacteristic?
    private var languageCharacteristic: CBMutableCharacteristic?
    private var statusCharacteristic: CBMutableCharacteristic?
    private var connectionRequestCharacteristic: CBMutableCharacteristic?

    public func definition() -> ModuleDefinition {
        Name("VoxLinkBLEAdvertiser")

        Events("onStateChange", "onConnectionRequest", "onError")

        // Check if advertising is supported
        AsyncFunction("isAdvertisingSupported") { () -> Bool in
            return true // iOS devices support BLE advertising
        }

        // Get current state
        AsyncFunction("getState") { () -> String in
            return self.state
        }

        // Start advertising
        AsyncFunction("startAdvertising") { (data: AdvertiseData) in
            self.currentData = data
            self.setupPeripheralManager()
        }

        // Stop advertising
        AsyncFunction("stopAdvertising") { () in
            self.stopAdvertisingInternal()
        }

        // Update advertising data
        AsyncFunction("updateAdvertiseData") { (data: AdvertiseData) in
            if let currentData = self.currentData {
                // Merge new data with existing
                var updated = currentData
                if !data.sessionId.isEmpty {
                    updated.sessionId = data.sessionId
                }
                if !data.language.isEmpty {
                    updated.language = data.language
                }
                if data.status != 0 {
                    updated.status = data.status
                }
                self.currentData = updated
                self.updateCharacteristics()
            }
        }
    }

    // MARK: - Private Methods

    private func setupPeripheralManager() {
        state = "starting"
        sendEvent("onStateChange", ["state": state])

        delegate = PeripheralManagerDelegate(module: self)
        peripheralManager = CBPeripheralManager(delegate: delegate, queue: nil)
    }

    func onPeripheralManagerReady() {
        guard let peripheralManager = peripheralManager else { return }

        // Create service and characteristics
        createService()

        guard let service = service else { return }

        // Add service
        peripheralManager.add(service)
    }

    private func createService() {
        // User ID characteristic (read)
        userIdCharacteristic = CBMutableCharacteristic(
            type: CHARACTERISTIC_USER_ID,
            properties: [.read],
            value: nil,
            permissions: [.readable]
        )

        // Language characteristic (read)
        languageCharacteristic = CBMutableCharacteristic(
            type: CHARACTERISTIC_LANGUAGE,
            properties: [.read],
            value: nil,
            permissions: [.readable]
        )

        // Status characteristic (read)
        statusCharacteristic = CBMutableCharacteristic(
            type: CHARACTERISTIC_STATUS,
            properties: [.read],
            value: nil,
            permissions: [.readable]
        )

        // Connection request characteristic (write)
        connectionRequestCharacteristic = CBMutableCharacteristic(
            type: CHARACTERISTIC_CONNECTION_REQUEST,
            properties: [.write, .writeWithoutResponse],
            value: nil,
            permissions: [.writeable]
        )

        // Create service
        service = CBMutableService(type: VOXLINK_SERVICE_UUID, primary: true)
        service?.characteristics = [
            userIdCharacteristic!,
            languageCharacteristic!,
            statusCharacteristic!,
            connectionRequestCharacteristic!
        ]

        // Set initial values
        updateCharacteristics()
    }

    private func updateCharacteristics() {
        guard let data = currentData else { return }

        // Update User ID (16 bytes from session ID string)
        if let sessionData = data.sessionId.data(using: .utf8) {
            var paddedData = Data(count: 16)
            let copyLength = min(sessionData.count, 16)
            paddedData.replaceSubrange(0..<copyLength, with: sessionData.prefix(copyLength))
            userIdCharacteristic?.value = paddedData
        }

        // Update Language (2 bytes)
        if let langData = data.language.prefix(2).data(using: .utf8) {
            languageCharacteristic?.value = langData
        }

        // Update Status (1 byte)
        var statusByte = UInt8(data.status)
        statusCharacteristic?.value = Data(bytes: &statusByte, count: 1)
    }

    func onServiceAdded(error: Error?) {
        guard let peripheralManager = peripheralManager else { return }

        if let error = error {
            state = "error"
            sendEvent("onStateChange", ["state": state])
            sendEvent("onError", [
                "code": "E020",
                "message": error.localizedDescription
            ])
            return
        }

        // Start advertising
        let advertisementData: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [VOXLINK_SERVICE_UUID],
            CBAdvertisementDataLocalNameKey: "Voxxo"
        ]

        peripheralManager.startAdvertising(advertisementData)
    }

    func onAdvertisingStarted(error: Error?) {
        if let error = error {
            state = "error"
            sendEvent("onStateChange", ["state": state])
            sendEvent("onError", [
                "code": "E021",
                "message": error.localizedDescription
            ])
            return
        }

        state = "advertising"
        sendEvent("onStateChange", ["state": state])
    }

    func onWriteRequest(characteristic: CBCharacteristic, value: Data) {
        // Handle connection request
        if characteristic.uuid == CHARACTERISTIC_CONNECTION_REQUEST {
            // Parse connection request: [16 bytes sessionId][2 bytes language][6 bytes roomCode]
            if value.count >= 24 {
                let sessionIdData = value.prefix(16)
                let languageData = value.subdata(in: 16..<18)
                let roomCodeData = value.subdata(in: 18..<24)

                let sessionId = String(data: sessionIdData, encoding: .utf8)?.trimmingCharacters(in: .controlCharacters) ?? ""
                let language = String(data: languageData, encoding: .utf8) ?? ""
                let roomCode = String(data: roomCodeData, encoding: .utf8) ?? ""

                sendEvent("onConnectionRequest", [
                    "fromSessionId": sessionId,
                    "fromLanguage": language,
                    "roomCode": roomCode
                ])
            }
        }
    }

    func onReadRequest(characteristic: CBCharacteristic) -> Data? {
        return characteristic.value
    }

    private func stopAdvertisingInternal() {
        peripheralManager?.stopAdvertising()
        peripheralManager?.removeAllServices()
        peripheralManager = nil
        delegate = nil
        service = nil
        currentData = nil
        state = "idle"
        sendEvent("onStateChange", ["state": state])
    }

    func onPeripheralManagerStateChanged(_ state: CBManagerState) {
        switch state {
        case .poweredOff:
            sendEvent("onError", [
                "code": "E001",
                "message": "Bluetooth is powered off"
            ])
        case .unauthorized:
            sendEvent("onError", [
                "code": "E002",
                "message": "Bluetooth permission denied"
            ])
        case .unsupported:
            sendEvent("onError", [
                "code": "E003",
                "message": "Bluetooth not supported"
            ])
        case .poweredOn:
            onPeripheralManagerReady()
        default:
            break
        }
    }
}

// MARK: - Peripheral Manager Delegate

private class PeripheralManagerDelegate: NSObject, CBPeripheralManagerDelegate {
    private weak var module: VoxLinkBLEAdvertiserModule?

    init(module: VoxLinkBLEAdvertiserModule) {
        self.module = module
    }

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        module?.onPeripheralManagerStateChanged(peripheral.state)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        module?.onServiceAdded(error: error)
    }

    func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        module?.onAdvertisingStarted(error: error)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        if let data = module?.onReadRequest(characteristic: request.characteristic) {
            request.value = data
            peripheral.respond(to: request, withResult: .success)
        } else {
            peripheral.respond(to: request, withResult: .attributeNotFound)
        }
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if let value = request.value {
                module?.onWriteRequest(characteristic: request.characteristic, value: value)
            }
            peripheral.respond(to: request, withResult: .success)
        }
    }
}
