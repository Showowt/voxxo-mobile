/**
 * Entrevoz Mobile Root Layout
 *
 * Handles:
 * - Navigation stack
 * - Auto permission requests on launch
 * - Global styling
 */

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, Platform } from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

/**
 * Request all necessary permissions on app launch.
 * This ensures users grant permissions upfront for a seamless experience.
 */
async function requestPermissionsOnLaunch() {
  if (Platform.OS === "web") {
    return;
  }

  try {
    // Request speech recognition permission (which includes microphone on iOS)
    const speechStatus =
      await ExpoSpeechRecognitionModule.getPermissionsAsync();

    if (!speechStatus.granted && speechStatus.canAskAgain) {
      console.log("[Entrevoz] Requesting speech recognition permission...");
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      console.log(
        "[Entrevoz] Speech permission result:",
        result.granted ? "granted" : "denied",
      );
    }
  } catch (error) {
    // Silently fail if permissions module not available (e.g., on simulator)
    console.log("[Entrevoz] Permission request skipped:", error);
  }
}

export default function RootLayout() {
  // Request permissions on mount
  useEffect(() => {
    requestPermissionsOnLaunch();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: styles.content,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="radar" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="talk/[code]" />
        <Stack.Screen name="call-wingman" />
        <Stack.Screen name="wingman" />
        <Stack.Screen name="face-to-face" />
        <Stack.Screen name="vox-type" />
        <Stack.Screen name="vox-note" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E14",
  },
  content: {
    backgroundColor: "#0A0E14",
  },
});
