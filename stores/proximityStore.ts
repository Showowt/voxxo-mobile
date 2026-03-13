/**
 * Entrevoz Proximity Store
 *
 * Zustand store for managing BLE proximity discovery, connection requests,
 * and active conversations.
 *
 * @version 1.0.0
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Platform } from "react-native";

// Platform-specific storage
// SSR-safe: checks for window at runtime, not import time
const getStorage = () => {
  if (Platform.OS === "web") {
    // Return SSR-safe localStorage wrapper
    // All methods check typeof window !== 'undefined' at runtime
    return {
      getItem: (name: string): Promise<string | null> => {
        if (typeof window === "undefined") {
          // SSR: return null, no localStorage available
          return Promise.resolve(null);
        }
        try {
          const value = localStorage.getItem(name);
          return Promise.resolve(value);
        } catch {
          // localStorage may be disabled (private browsing, etc.)
          return Promise.resolve(null);
        }
      },
      setItem: (name: string, value: string): Promise<void> => {
        if (typeof window === "undefined") {
          // SSR: no-op
          return Promise.resolve();
        }
        try {
          localStorage.setItem(name, value);
        } catch {
          // localStorage may be disabled or quota exceeded
          console.warn("[ProximityStore] localStorage.setItem failed");
        }
        return Promise.resolve();
      },
      removeItem: (name: string): Promise<void> => {
        if (typeof window === "undefined") {
          // SSR: no-op
          return Promise.resolve();
        }
        try {
          localStorage.removeItem(name);
        } catch {
          // localStorage may be disabled
          console.warn("[ProximityStore] localStorage.removeItem failed");
        }
        return Promise.resolve();
      },
    };
  }
  // Native: use AsyncStorage (dynamically required to avoid web bundling issues)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  return AsyncStorage;
};

import type {
  MyPresence,
  NearbyUser,
  ConnectionRequest,
  ConversationState,
  ProximityState,
  BLEState,
  ConnectionState,
} from "../types";

import {
  USER_STATUS,
  CONNECTION_CONFIG,
  DISTANCE_CONFIG,
  generateRoomCode,
  type LanguageCode,
  type UserStatus,
} from "../constants/ble";

// ═══════════════════════════════════════════════════════════════════════════════
// UUID GENERATION (Polyfill for React Native)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a UUID v4 compatible string
 * Uses Math.random() which is sufficient for session IDs
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialMyPresence: MyPresence = {
  sessionId: "",
  language: "en",
  status: USER_STATUS.AVAILABLE,
  isScanning: false,
  isAdvertising: false,
};

const initialState: ProximityState = {
  myPresence: initialMyPresence,
  nearbyUsers: {},
  selectedUser: null,
  bleState: "unknown",
  bleError: null,
  connectionState: "idle",
  incomingRequest: null,
  outgoingRequest: null,
  conversation: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// STORE ACTIONS INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface ProximityActions {
  // Initialization
  initialize: () => Promise<void>;
  reset: () => void;

  // BLE State Management
  setBLEState: (state: BLEState) => void;
  setBLEError: (error: string | null) => void;

  // Scanning
  startScanning: () => void;
  stopScanning: () => void;

  // Advertising
  startAdvertising: () => void;
  stopAdvertising: () => void;

  // User Selection
  selectUser: (user: NearbyUser) => void;
  clearSelection: () => void;

  // Connection Requests
  sendConnectionRequest: (user: NearbyUser) => ConnectionRequest;
  cancelConnectionRequest: () => void;
  setIncomingRequest: (request: ConnectionRequest | null) => void;
  acceptIncomingRequest: () => void;
  rejectIncomingRequest: () => void;

  // My Presence
  updateMyLanguage: (language: LanguageCode) => void;
  updateMyStatus: (status: UserStatus) => void;

  // Nearby Users
  addNearbyUser: (user: NearbyUser) => void;
  updateNearbyUser: (id: string, updates: Partial<NearbyUser>) => void;
  removeNearbyUser: (id: string) => void;
  removeStaleUsers: () => void;
  clearNearbyUsers: () => void;

  // Connection State
  setConnectionState: (state: ConnectionState) => void;

  // Conversation
  setConversation: (conversation: ConversationState | null) => void;
  updateConversation: (updates: Partial<ConversationState>) => void;
  addMessage: (message: ConversationState["messages"][number]) => void;
  updateLiveText: (
    speaker: "me" | "partner",
    text: string,
    translation: string,
  ) => void;
  endConversation: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERSISTED SETTINGS (Separate store for settings that persist)
// ═══════════════════════════════════════════════════════════════════════════════

interface PersistedSettings {
  language: LanguageCode;
  status: UserStatus;
}

const usePersistedSettings = create<PersistedSettings>()(
  persist(
    () => ({
      language: "en" as LanguageCode,
      status: USER_STATUS.AVAILABLE as UserStatus,
    }),
    {
      name: "voxxo-proximity-settings",
      storage: createJSONStorage(() => getStorage()),
    },
  ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROXIMITY STORE
// ═══════════════════════════════════════════════════════════════════════════════

export const useProximityStore = create<ProximityState & ProximityActions>()(
  (set, get) => ({
    // Initial state
    ...initialState,

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    initialize: async () => {
      // Generate unique session ID
      const sessionId = generateUUID();

      // Load persisted settings
      const { language, status } = usePersistedSettings.getState();

      set({
        myPresence: {
          sessionId,
          language,
          status,
          isScanning: false,
          isAdvertising: false,
        },
        bleState: "unknown",
        bleError: null,
      });
    },

    reset: () => {
      set(initialState);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // BLE STATE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    setBLEState: (bleState: BLEState) => {
      set({ bleState });
    },

    setBLEError: (bleError: string | null) => {
      set({ bleError });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SCANNING
    // ─────────────────────────────────────────────────────────────────────────

    startScanning: () => {
      const { myPresence, bleState } = get();

      if (bleState !== "poweredOn" && bleState !== "advertising") {
        console.warn("[ProximityStore] Cannot start scanning - BLE not ready");
        return;
      }

      set({
        myPresence: { ...myPresence, isScanning: true },
        bleState: myPresence.isAdvertising ? "advertising" : "scanning",
      });
    },

    stopScanning: () => {
      const { myPresence } = get();

      set({
        myPresence: { ...myPresence, isScanning: false },
        bleState: myPresence.isAdvertising ? "advertising" : "poweredOn",
      });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ADVERTISING
    // ─────────────────────────────────────────────────────────────────────────

    startAdvertising: () => {
      const { myPresence, bleState } = get();

      if (bleState !== "poweredOn" && bleState !== "scanning") {
        console.warn(
          "[ProximityStore] Cannot start advertising - BLE not ready",
        );
        return;
      }

      set({
        myPresence: { ...myPresence, isAdvertising: true },
        bleState: "advertising",
      });
    },

    stopAdvertising: () => {
      const { myPresence } = get();

      set({
        myPresence: { ...myPresence, isAdvertising: false },
        bleState: myPresence.isScanning ? "scanning" : "poweredOn",
      });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // USER SELECTION
    // ─────────────────────────────────────────────────────────────────────────

    selectUser: (user: NearbyUser) => {
      set({ selectedUser: user });
    },

    clearSelection: () => {
      set({ selectedUser: null });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONNECTION REQUESTS
    // ─────────────────────────────────────────────────────────────────────────

    sendConnectionRequest: (user: NearbyUser): ConnectionRequest => {
      const { myPresence } = get();
      const now = Date.now();

      const request: ConnectionRequest = {
        id: `req_${now}_${Math.random().toString(36).substring(2, 8)}`,
        fromSessionId: myPresence.sessionId,
        fromLanguage: myPresence.language,
        roomCode: generateRoomCode(),
        createdAt: now,
        expiresAt: now + CONNECTION_CONFIG.REQUEST_TIMEOUT_MS,
        status: "pending",
      };

      set({
        outgoingRequest: request,
        connectionState: "requesting",
        selectedUser: user,
      });

      return request;
    },

    cancelConnectionRequest: () => {
      const { outgoingRequest } = get();

      if (outgoingRequest) {
        set({
          outgoingRequest: { ...outgoingRequest, status: "cancelled" },
          connectionState: "idle",
        });

        // Clear the request after a short delay
        setTimeout(() => {
          set({ outgoingRequest: null });
        }, 100);
      }
    },

    setIncomingRequest: (request: ConnectionRequest | null) => {
      set({
        incomingRequest: request,
        connectionState: request ? "incoming" : "idle",
      });
    },

    acceptIncomingRequest: () => {
      const { incomingRequest } = get();

      if (!incomingRequest) {
        console.warn("[ProximityStore] No incoming request to accept");
        return;
      }

      set({
        incomingRequest: { ...incomingRequest, status: "accepted" },
        connectionState: "connecting",
      });
    },

    rejectIncomingRequest: () => {
      const { incomingRequest } = get();

      if (!incomingRequest) {
        console.warn("[ProximityStore] No incoming request to reject");
        return;
      }

      set({
        incomingRequest: { ...incomingRequest, status: "rejected" },
        connectionState: "idle",
      });

      // Clear the request after a short delay
      setTimeout(() => {
        set({ incomingRequest: null });
      }, 100);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MY PRESENCE
    // ─────────────────────────────────────────────────────────────────────────

    updateMyLanguage: (language: LanguageCode) => {
      const { myPresence } = get();

      set({
        myPresence: { ...myPresence, language },
      });

      // Persist to settings store
      usePersistedSettings.setState({ language });
    },

    updateMyStatus: (status: UserStatus) => {
      const { myPresence } = get();

      set({
        myPresence: { ...myPresence, status },
      });

      // Persist to settings store
      usePersistedSettings.setState({ status });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // NEARBY USERS
    // ─────────────────────────────────────────────────────────────────────────

    addNearbyUser: (user: NearbyUser) => {
      const { nearbyUsers } = get();

      set({
        nearbyUsers: {
          ...nearbyUsers,
          [user.id]: user,
        },
      });
    },

    updateNearbyUser: (id: string, updates: Partial<NearbyUser>) => {
      const { nearbyUsers } = get();

      if (!nearbyUsers[id]) {
        console.warn(`[ProximityStore] User ${id} not found for update`);
        return;
      }

      set({
        nearbyUsers: {
          ...nearbyUsers,
          [id]: { ...nearbyUsers[id], ...updates },
        },
      });
    },

    removeNearbyUser: (id: string) => {
      const { nearbyUsers, selectedUser } = get();
      const { [id]: removed, ...remaining } = nearbyUsers;

      set({
        nearbyUsers: remaining,
        // Clear selection if removed user was selected
        selectedUser: selectedUser?.id === id ? null : selectedUser,
      });
    },

    removeStaleUsers: () => {
      const { nearbyUsers, selectedUser } = get();
      const now = Date.now();
      const staleThreshold = DISTANCE_CONFIG.STALE_TIMEOUT_MS;

      const freshUsers: Record<string, NearbyUser> = {};
      let selectionCleared = false;

      Object.entries(nearbyUsers).forEach(([id, user]) => {
        if (now - user.lastSeen < staleThreshold) {
          freshUsers[id] = user;
        } else if (selectedUser?.id === id) {
          selectionCleared = true;
        }
      });

      set({
        nearbyUsers: freshUsers,
        selectedUser: selectionCleared ? null : selectedUser,
      });
    },

    clearNearbyUsers: () => {
      set({
        nearbyUsers: {},
        selectedUser: null,
      });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONNECTION STATE
    // ─────────────────────────────────────────────────────────────────────────

    setConnectionState: (connectionState: ConnectionState) => {
      set({ connectionState });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONVERSATION
    // ─────────────────────────────────────────────────────────────────────────

    setConversation: (conversation: ConversationState | null) => {
      set({
        conversation,
        connectionState: conversation ? "connected" : "idle",
      });
    },

    updateConversation: (updates: Partial<ConversationState>) => {
      const { conversation } = get();

      if (!conversation) {
        console.warn("[ProximityStore] No active conversation to update");
        return;
      }

      set({
        conversation: { ...conversation, ...updates },
      });
    },

    addMessage: (message: ConversationState["messages"][number]) => {
      const { conversation } = get();

      if (!conversation) {
        console.warn("[ProximityStore] No active conversation for message");
        return;
      }

      set({
        conversation: {
          ...conversation,
          messages: [...conversation.messages, message],
        },
      });
    },

    updateLiveText: (
      speaker: "me" | "partner",
      text: string,
      translation: string,
    ) => {
      const { conversation } = get();

      if (!conversation) {
        return;
      }

      if (speaker === "me") {
        set({
          conversation: {
            ...conversation,
            myLiveText: text,
            myLiveTranslation: translation,
          },
        });
      } else {
        set({
          conversation: {
            ...conversation,
            partnerLiveText: text,
            partnerLiveTranslation: translation,
          },
        });
      }
    },

    endConversation: () => {
      set({
        conversation: null,
        connectionState: "idle",
        selectedUser: null,
        incomingRequest: null,
        outgoingRequest: null,
      });
    },
  }),
);

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get nearby users as a sorted array (by distance, then by last seen)
 */
export const selectNearbyUsersArray = (state: ProximityState): NearbyUser[] => {
  return Object.values(state.nearbyUsers).sort((a, b) => {
    // Primary sort: by distance (closest first)
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    // Secondary sort: by last seen (most recent first)
    return b.lastSeen - a.lastSeen;
  });
};

/**
 * Check if the store is ready for proximity operations
 */
export const selectIsReady = (state: ProximityState): boolean => {
  return (
    state.myPresence.sessionId !== "" &&
    (state.bleState === "poweredOn" ||
      state.bleState === "scanning" ||
      state.bleState === "advertising")
  );
};

/**
 * Check if currently in an active connection flow
 */
export const selectIsConnecting = (state: ProximityState): boolean => {
  return ["requesting", "waiting", "incoming", "connecting"].includes(
    state.connectionState,
  );
};

/**
 * Check if currently in an active conversation
 */
export const selectIsInConversation = (state: ProximityState): boolean => {
  return state.connectionState === "connected" && state.conversation !== null;
};

/**
 * Get count of nearby users by distance category
 */
export const selectNearbyUserCounts = (
  state: ProximityState,
): Record<string, number> => {
  const users = Object.values(state.nearbyUsers);

  return {
    immediate: users.filter((u) => u.distanceCategory === "immediate").length,
    near: users.filter((u) => u.distanceCategory === "near").length,
    far: users.filter((u) => u.distanceCategory === "far").length,
    total: users.length,
  };
};

/**
 * Get available users (status = available, not in call)
 */
export const selectAvailableUsers = (state: ProximityState): NearbyUser[] => {
  return Object.values(state.nearbyUsers).filter(
    (user) => user.status === USER_STATUS.AVAILABLE,
  );
};

/**
 * Get users by language
 */
export const selectUsersByLanguage = (
  state: ProximityState,
  language: LanguageCode,
): NearbyUser[] => {
  return Object.values(state.nearbyUsers).filter(
    (user) => user.language === language,
  );
};

/**
 * Check if BLE is in an error state
 */
export const selectHasBLEError = (state: ProximityState): boolean => {
  return (
    state.bleError !== null ||
    state.bleState === "unsupported" ||
    state.bleState === "unauthorized" ||
    state.bleState === "poweredOff"
  );
};

/**
 * Get outgoing request timeout remaining (ms)
 */
export const selectOutgoingRequestTimeRemaining = (
  state: ProximityState,
): number => {
  if (!state.outgoingRequest || state.outgoingRequest.status !== "pending") {
    return 0;
  }

  const remaining = state.outgoingRequest.expiresAt - Date.now();
  return Math.max(0, remaining);
};

/**
 * Get incoming request timeout remaining (ms)
 */
export const selectIncomingRequestTimeRemaining = (
  state: ProximityState,
): number => {
  if (!state.incomingRequest || state.incomingRequest.status !== "pending") {
    return 0;
  }

  const remaining = state.incomingRequest.expiresAt - Date.now();
  return Math.max(0, remaining);
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS (Convenience wrappers with selectors)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to get nearby users as array
 */
export const useNearbyUsersArray = () =>
  useProximityStore(selectNearbyUsersArray);

/**
 * Hook to check if ready
 */
export const useIsReady = () => useProximityStore(selectIsReady);

/**
 * Hook to check if connecting
 */
export const useIsConnecting = () => useProximityStore(selectIsConnecting);

/**
 * Hook to check if in conversation
 */
export const useIsInConversation = () =>
  useProximityStore(selectIsInConversation);

/**
 * Hook to get user counts
 */
export const useNearbyUserCounts = () =>
  useProximityStore(selectNearbyUserCounts);

/**
 * Hook to get BLE error state
 */
export const useHasBLEError = () => useProximityStore(selectHasBLEError);

// ═══════════════════════════════════════════════════════════════════════════════
// STORE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to proximity store changes (for debugging)
 */
export const subscribeToProximityStore = (
  callback: (state: ProximityState) => void,
) => {
  return useProximityStore.subscribe(callback);
};

/**
 * Get current store state (for debugging)
 */
export const getProximityStoreState = () => useProximityStore.getState();

/**
 * Export persisted settings store for direct access if needed
 */
export { usePersistedSettings };
