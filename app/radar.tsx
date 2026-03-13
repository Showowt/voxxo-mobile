/**
 * Entrevoz Radar Screen
 *
 * BLE proximity discovery with real scanner on devices,
 * mock fallback for web/simulator.
 *
 * @version 2.0.0
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as ExpoDevice from "expo-device";

import {
  LANGUAGES,
  getLanguageByCode,
  generateRoomCode,
  type LanguageCode,
} from "../constants/ble";
import { useProximityStore } from "../stores/proximityStore";

// ═══════════════════════════════════════════════════════════════════════════════
// BLE SCANNER IMPORT (conditional for web compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

// Types matching the BLE Scanner module
interface DiscoveredDevice {
  deviceId: string;
  sessionId: string;
  language: string;
  status: number;
  rssi: number;
  distance: number;
  lastSeen: number;
}

type BluetoothState =
  | "unknown"
  | "resetting"
  | "unsupported"
  | "unauthorized"
  | "poweredOff"
  | "poweredOn";

type ScannerState = "idle" | "starting" | "scanning" | "stopping" | "error";

// Scanner module interface
interface BLEScannerModule {
  isScanningSupported: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  getBluetoothState: () => Promise<BluetoothState>;
  startScanning: (options?: { allowDuplicates?: boolean }) => Promise<void>;
  stopScanning: () => Promise<void>;
  getState: () => Promise<ScannerState>;
  sendConnectionRequest: (
    deviceId: string,
    sessionId: string,
    language: string,
    roomCode: string,
  ) => Promise<void>;
  addStateChangeListener: (
    listener: (event: { state: ScannerState }) => void,
  ) => { remove: () => void } | null;
  addBluetoothStateChangeListener: (
    listener: (event: { state: BluetoothState }) => void,
  ) => { remove: () => void } | null;
  addDeviceDiscoveredListener: (
    listener: (device: DiscoveredDevice) => void,
  ) => { remove: () => void } | null;
  addDeviceLostListener: (
    listener: (event: { deviceId: string }) => void,
  ) => { remove: () => void } | null;
  addErrorListener: (
    listener: (event: { code: string; message: string }) => void,
  ) => { remove: () => void } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEARBY USER TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface NearbyUser {
  id: string;
  deviceId: string;
  sessionId: string;
  language: LanguageCode;
  distance: number;
  flag: string;
  name: string;
  lastSeen: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA FOR WEB/SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_LANGUAGES = [
  { code: "es", flag: "🇪🇸", name: "Spanish" },
  { code: "fr", flag: "🇫🇷", name: "French" },
  { code: "de", flag: "🇩🇪", name: "German" },
  { code: "zh", flag: "🇨🇳", name: "Chinese" },
  { code: "ja", flag: "🇯🇵", name: "Japanese" },
  { code: "pt", flag: "🇧🇷", name: "Portuguese" },
  { code: "it", flag: "🇮🇹", name: "Italian" },
  { code: "ko", flag: "🇰🇷", name: "Korean" },
];

function generateMockUser(): NearbyUser {
  const lang =
    MOCK_LANGUAGES[Math.floor(Math.random() * MOCK_LANGUAGES.length)];
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    deviceId: `mock-device-${Date.now()}`,
    sessionId: `mock-session-${Date.now()}`,
    language: lang.code as LanguageCode,
    distance: 2 + Math.random() * 15,
    flag: lang.flag,
    name: lang.name,
    lastSeen: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RadarScreen() {
  const router = useRouter();
  const { myPresence } = useProximityStore();

  // State
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [bluetoothState, setBluetoothState] =
    useState<BluetoothState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [useMockMode, setUseMockMode] = useState(false);

  // Refs
  const scannerRef = useRef<BLEScannerModule | null>(null);
  const subscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIALIZE SCANNER
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const initializeScanner = async () => {
      // Check if we should use mock mode
      const isPhysicalDevice = ExpoDevice.isDevice;
      const isWeb = Platform.OS === "web";

      if (!isPhysicalDevice || isWeb) {
        console.log("[Radar] Using mock mode (simulator/web)");
        setUseMockMode(true);
        startMockScanning();
        return;
      }

      // Try to load the native BLE Scanner module
      try {
        const BLEScanner = require("../../modules/voxlink-ble-scanner/src")
          .default as BLEScannerModule;
        scannerRef.current = BLEScanner;

        // Check if scanning is supported
        const supported = await BLEScanner.isScanningSupported();
        if (!supported) {
          console.log("[Radar] BLE scanning not supported, using mock mode");
          setUseMockMode(true);
          startMockScanning();
          return;
        }

        // Request permissions
        const hasPermission = await BLEScanner.requestPermissions();
        if (!hasPermission) {
          if (mounted) {
            setError("Bluetooth permission required");
            setUseMockMode(true);
            startMockScanning();
          }
          return;
        }

        // Set up event listeners
        const stateListener = BLEScanner.addStateChangeListener((event) => {
          if (mounted) setScannerState(event.state);
        });

        const btStateListener = BLEScanner.addBluetoothStateChangeListener(
          (event) => {
            if (mounted) {
              setBluetoothState(event.state);
              if (event.state === "poweredOff") {
                setError("Please turn on Bluetooth");
              } else if (event.state === "unauthorized") {
                setError("Bluetooth permission denied");
              } else if (event.state === "poweredOn") {
                setError(null);
              }
            }
          },
        );

        const deviceListener = BLEScanner.addDeviceDiscoveredListener(
          (device) => {
            if (mounted) {
              handleDeviceDiscovered(device);
            }
          },
        );

        const lostListener = BLEScanner.addDeviceLostListener((event) => {
          if (mounted) {
            setUsers((prev) =>
              prev.filter((u) => u.deviceId !== event.deviceId),
            );
          }
        });

        const errorListener = BLEScanner.addErrorListener((event) => {
          if (mounted) {
            console.error("[Radar] BLE Error:", event.code, event.message);
            if (
              event.code === "E001" ||
              event.code === "E002" ||
              event.code === "E003"
            ) {
              setError(event.message);
            }
          }
        });

        // Store subscriptions for cleanup
        if (stateListener) subscriptionsRef.current.push(stateListener);
        if (btStateListener) subscriptionsRef.current.push(btStateListener);
        if (deviceListener) subscriptionsRef.current.push(deviceListener);
        if (lostListener) subscriptionsRef.current.push(lostListener);
        if (errorListener) subscriptionsRef.current.push(errorListener);

        // Start scanning
        await BLEScanner.startScanning({ allowDuplicates: true });
      } catch (err) {
        console.log(
          "[Radar] Failed to load BLE Scanner, using mock mode:",
          err,
        );
        if (mounted) {
          setUseMockMode(true);
          startMockScanning();
        }
      }
    };

    initializeScanner();

    return () => {
      mounted = false;

      // Clean up subscriptions
      subscriptionsRef.current.forEach((sub) => sub.remove());
      subscriptionsRef.current = [];

      // Stop scanning
      if (scannerRef.current) {
        scannerRef.current.stopScanning().catch(() => {});
      }

      // Stop mock scanning
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // MOCK SCANNING (for web/simulator)
  // ─────────────────────────────────────────────────────────────────────────────

  const startMockScanning = useCallback(() => {
    setScannerState("scanning");

    // Add initial mock users
    setUsers([generateMockUser(), generateMockUser(), generateMockUser()]);

    // Add new users periodically
    mockIntervalRef.current = setInterval(() => {
      setUsers((prev) => {
        // Remove stale users (older than 20 seconds)
        const now = Date.now();
        const active = prev.filter((u) => now - u.lastSeen < 20000);

        // Add a new user if we have less than 6
        if (active.length < 6 && Math.random() > 0.3) {
          return [...active, generateMockUser()];
        }

        // Update distances randomly
        return active.map((u) => ({
          ...u,
          distance: Math.max(1, u.distance + (Math.random() - 0.5) * 2),
          lastSeen: now,
        }));
      });
    }, 3000);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // DEVICE DISCOVERED HANDLER
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDeviceDiscovered = useCallback((device: DiscoveredDevice) => {
    const langInfo = getLanguageByCode(device.language);

    const nearbyUser: NearbyUser = {
      id: device.deviceId,
      deviceId: device.deviceId,
      sessionId: device.sessionId,
      language: (device.language || "en") as LanguageCode,
      distance: device.distance > 0 ? device.distance : 5,
      flag: langInfo.flag,
      name: langInfo.name,
      lastSeen: device.lastSeen,
    };

    setUsers((prev) => {
      const existingIndex = prev.findIndex(
        (u) => u.deviceId === device.deviceId,
      );
      if (existingIndex >= 0) {
        // Update existing user
        const updated = [...prev];
        updated[existingIndex] = nearbyUser;
        return updated;
      } else {
        // Add new user (max 10)
        if (prev.length >= 10) {
          return [...prev.slice(1), nearbyUser];
        }
        return [...prev, nearbyUser];
      }
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // USER ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSelectUser = (user: NearbyUser) => {
    setSelectedUser(user);
  };

  const handleConnect = async () => {
    if (!selectedUser) return;

    const roomCode = generateRoomCode();

    // If using real BLE, send connection request
    if (!useMockMode && scannerRef.current && selectedUser.deviceId) {
      try {
        await scannerRef.current.sendConnectionRequest(
          selectedUser.deviceId,
          myPresence.sessionId,
          myPresence.language,
          roomCode,
        );
      } catch (err) {
        console.error("[Radar] Failed to send connection request:", err);
        // Continue anyway - fallback to realtime-only connection
      }
    }

    // Navigate to conversation
    router.push({
      pathname: "/conversation",
      params: {
        roomCode,
        partnerLanguage: selectedUser.language,
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const handleRetry = async () => {
    setError(null);

    if (scannerRef.current) {
      try {
        await scannerRef.current.startScanning({ allowDuplicates: true });
      } catch {
        setError("Failed to start scanning");
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const isScanning = scannerState === "scanning";
  const sortedUsers = [...users].sort((a, b) => a.distance - b.distance);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the language selection screen"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>People Nearby</Text>
        <View style={styles.scanIndicator}>
          <View style={[styles.scanDot, isScanning && styles.scanDotActive]} />
          <Text style={styles.scanText}>
            {isScanning
              ? "Scanning..."
              : scannerState === "error"
                ? "Error"
                : "Paused"}
          </Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <Pressable style={styles.errorBanner} onPress={handleRetry}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>Tap to retry</Text>
        </Pressable>
      )}

      {/* Mock Mode Indicator */}
      {useMockMode && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>Demo Mode - Simulated Users</Text>
        </View>
      )}

      {/* Radar Visualization */}
      <View style={styles.radarContainer}>
        <View style={styles.radar}>
          <View style={[styles.radarRing, styles.radarRing1]} />
          <View style={[styles.radarRing, styles.radarRing2]} />
          <View style={[styles.radarRing, styles.radarRing3]} />
          <View style={styles.radarCenter}>
            <Text style={styles.radarCenterText}>YOU</Text>
          </View>
        </View>
      </View>

      {/* User List */}
      <View style={styles.userListContainer}>
        <Text style={styles.userListTitle}>
          {sortedUsers.length} speaker{sortedUsers.length !== 1 ? "s" : ""}{" "}
          nearby
        </Text>

        {sortedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📡</Text>
            <Text style={styles.emptyStateTitle}>Looking for speakers...</Text>
            <Text style={styles.emptyStateText}>
              Make sure Bluetooth is enabled and other Entrevoz users are nearby
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.userList}>
            {sortedUsers.map((user) => (
              <Pressable
                key={user.id}
                style={[
                  styles.userCard,
                  selectedUser?.id === user.id && styles.userCardSelected,
                ]}
                onPress={() => handleSelectUser(user)}
                accessibilityRole="button"
                accessibilityLabel={`${user.name} speaker, ${user.distance.toFixed(1)} meters away`}
                accessibilityState={{ selected: selectedUser?.id === user.id }}
                accessibilityHint="Double tap to select this person to connect with"
              >
                <Text style={styles.userFlag} accessibilityLabel={user.name}>
                  {user.flag}
                </Text>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name} Speaker</Text>
                  <Text style={styles.userDistance}>
                    {user.distance.toFixed(1)}m away
                  </Text>
                </View>
                {selectedUser?.id === user.id && (
                  <View
                    style={styles.selectedBadge}
                    accessibilityLabel="Selected"
                  >
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Connect Button */}
      {selectedUser && (
        <View style={styles.footer}>
          <Pressable
            style={styles.connectButton}
            onPress={handleConnect}
            accessibilityRole="button"
            accessibilityLabel={`Connect with ${selectedUser.name} speaker`}
            accessibilityHint="Starts a real-time translated conversation"
          >
            <Text style={styles.connectButtonText}>
              Connect with {selectedUser.name} Speaker →
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  backButtonText: {
    color: "#0088FF",
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  scanIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#52525b",
  },
  scanDotActive: {
    backgroundColor: "#00DBA8",
  },
  scanText: {
    fontSize: 12,
    color: "#71717a",
  },
  errorBanner: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
  },
  errorRetry: {
    color: "#fca5a5",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  mockBanner: {
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  mockText: {
    color: "#93c5fd",
    fontSize: 12,
  },
  radarContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  radar: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: "rgba(0, 219, 168, 0.3)",
  },
  radarRing1: {
    width: 200,
    height: 200,
  },
  radarRing2: {
    width: 140,
    height: 140,
  },
  radarRing3: {
    width: 80,
    height: 80,
  },
  radarCenter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00DBA8",
    alignItems: "center",
    justifyContent: "center",
  },
  radarCenterText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  userListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  userListTitle: {
    fontSize: 14,
    color: "#71717a",
    marginBottom: 12,
  },
  userList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#71717a",
    textAlign: "center",
    lineHeight: 20,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1F2E",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
    cursor: "pointer" as unknown as undefined,
  },
  userCardSelected: {
    borderColor: "#00DBA8",
    backgroundColor: "#0D2922",
  },
  userFlag: {
    fontSize: 32,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  userDistance: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 2,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00DBA8",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  footer: {
    padding: 16,
    paddingBottom: 40,
  },
  connectButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00DBA8",
    borderRadius: 14,
    paddingVertical: 18,
    cursor: "pointer" as unknown as undefined,
  },
  connectButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
});
