/**
 * Entrevoz Settings Screen
 *
 * User preferences and app settings.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LANGUAGES, type LanguageCode } from "../constants/ble";

interface SettingRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingRow({ label, value, onPress, rightElement }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={
        onPress ? `Opens ${label.toLowerCase()} options` : undefined
      }
    >
      <Text style={styles.settingLabel}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {rightElement}
      {onPress && <Text style={styles.settingChevron}>›</Text>}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  // Settings state
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const selectedLang = LANGUAGES.find((l) => l.code === language);

  const handleClose = () => {
    router.back();
  };

  const handleLanguageChange = (code: LanguageCode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(code);
    setShowLanguagePicker(false);
  };

  const toggleAutoSpeak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAutoSpeak((prev) => !prev);
  };

  const toggleHaptic = () => {
    if (hapticFeedback) {
      // One last haptic before turning off
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setHapticFeedback((prev) => !prev);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Done"
          accessibilityHint="Close settings and return to previous screen"
        >
          <Text style={styles.closeButton}>Done</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>

          {showLanguagePicker ? (
            <View style={styles.languagePicker}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    language === lang.code && styles.languageOptionSelected,
                  ]}
                  onPress={() =>
                    handleLanguageChange(lang.code as LanguageCode)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={lang.name}
                  accessibilityState={{ selected: language === lang.code }}
                  accessibilityHint="Double tap to select this language"
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <Text style={styles.languageName}>{lang.name}</Text>
                  {language === lang.code && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <SettingRow
              label="My Language"
              value={`${selectedLang?.flag} ${selectedLang?.name}`}
              onPress={() => setShowLanguagePicker(true)}
            />
          )}
        </View>

        {/* Translation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Translation</Text>

          <SettingRow
            label="Auto-speak translations"
            rightElement={
              <Switch
                value={autoSpeak}
                onValueChange={toggleAutoSpeak}
                trackColor={{ false: "#27272a", true: "#00DBA8" }}
                thumbColor="#fff"
                accessibilityLabel="Auto-speak translations toggle"
              />
            }
          />
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>

          <SettingRow
            label="Haptic feedback"
            rightElement={
              <Switch
                value={hapticFeedback}
                onValueChange={toggleHaptic}
                trackColor={{ false: "#27272a", true: "#00DBA8" }}
                thumbColor="#fff"
                accessibilityLabel="Haptic feedback toggle"
              />
            }
          />

          <SettingRow label="About Entrevoz" onPress={() => {}} />

          <SettingRow label="Privacy Policy" onPress={() => {}} />

          <SettingRow label="Terms of Service" onPress={() => {}} />
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.version}>Entrevoz v1.0.0</Text>
          <Text style={styles.copyright}>© 2026 MachineMind SAS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  closeButton: {
    color: "#0088FF",
    fontSize: 17,
    fontWeight: "600",
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  placeholder: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "#71717a",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1F2E",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  settingLabel: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  settingValue: {
    color: "#71717a",
    fontSize: 16,
    marginRight: 8,
  },
  settingChevron: {
    color: "#52525b",
    fontSize: 20,
    fontWeight: "300",
  },
  languagePicker: {
    backgroundColor: "#1A1F2E",
    maxHeight: 400,
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  languageOptionSelected: {
    backgroundColor: "#0D2922",
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  checkmark: {
    color: "#00DBA8",
    fontSize: 18,
    fontWeight: "600",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  version: {
    color: "#52525b",
    fontSize: 14,
    marginBottom: 4,
  },
  copyright: {
    color: "#3f3f46",
    fontSize: 12,
  },
});
