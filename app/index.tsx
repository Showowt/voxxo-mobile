/**
 * Entrevoz Home Screen
 *
 * Two killer features:
 * 1. Call Wingman - AI whispers perfect responses in your ear during calls
 * 2. Face-to-Face Link Mode - Universal translator via shareable link
 *
 * Dark luxury aesthetic with teal accent (#00E5A0)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import {
  generateRoomCode,
  shareConversationLink,
  getShareableUrl,
} from "../lib/link-generator";
import { useProximityStore } from "../stores/proximityStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Animated pulse ring component for visual flair
function PulseRing({ delay = 0 }: { delay?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.5,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

// Feature card component
function FeatureCard({
  icon,
  title,
  tagline,
  features,
  ctaText,
  href,
  accentColor,
  isPrimary = false,
}: {
  icon: string;
  title: string;
  tagline: string;
  features: string[];
  ctaText: string;
  href: string;
  accentColor: string;
  isPrimary?: boolean;
}) {
  return (
    <View style={[styles.featureCard, isPrimary && styles.featureCardPrimary]}>
      {/* Glow effect for primary card */}
      {isPrimary && (
        <View style={[styles.cardGlow, { backgroundColor: accentColor }]} />
      )}

      {/* Icon container */}
      <View style={[styles.iconContainer, { borderColor: accentColor }]}>
        <Text style={styles.iconText}>{icon}</Text>
        {isPrimary && (
          <>
            <PulseRing delay={0} />
            <PulseRing delay={700} />
          </>
        )}
      </View>

      {/* Content */}
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={[styles.featureTagline, { color: accentColor }]}>
        {tagline}
      </Text>

      {/* Feature list */}
      <View style={styles.featureList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <View
              style={[styles.featureDot, { backgroundColor: accentColor }]}
            />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* CTA Button */}
      <Link href={href as any} asChild>
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: accentColor },
            pressed && styles.ctaButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaText}
        >
          <Text style={styles.ctaText}>{ctaText}</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { myPresence, initialize } = useProximityStore();
  const [isSharing, setIsSharing] = useState(false);

  // Initialize store on mount
  useEffect(() => {
    if (!myPresence.sessionId) {
      initialize();
    }
  }, [myPresence.sessionId, initialize]);

  // Handle share link action
  const handleShareLink = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      // Generate a new room code
      const roomCode = generateRoomCode();
      const myLanguage = myPresence.language || "en";

      // Share the link
      const result = await shareConversationLink(roomCode, myLanguage);

      if (result.success) {
        if (result.action === "shared" || result.action === "copied") {
          // Navigate to conversation to wait for partner
          router.push({
            pathname: "/conversation",
            params: {
              roomCode: roomCode,
              partnerLanguage: "en", // Default, will update when partner joins
            },
          });
        }
      } else {
        // Show error alert
        if (Platform.OS === "web") {
          // Copy URL manually for web fallback
          const url = getShareableUrl(roomCode, myLanguage);
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            Alert.alert(
              "Link Copied",
              `Share this link with someone:\n${url}`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Open Chat",
                  onPress: () =>
                    router.push({
                      pathname: "/conversation",
                      params: { roomCode, partnerLanguage: "en" },
                    }),
                },
              ],
            );
          }
        } else {
          Alert.alert("Share Failed", result.error || "Could not share link");
        }
      }
    } catch (error) {
      console.error("[HomeScreen] Share error:", error);
      Alert.alert("Error", "Failed to create shareable link");
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, myPresence.language, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>V</Text>
            </View>
            <View style={styles.logoGlow} />
          </View>

          {/* Brand */}
          <Text style={styles.brandName}>ENTREVOZ</Text>
          <Text style={styles.tagline}>
            Your voice. Any language. Instantly.
          </Text>

          {/* Competitive badge */}
          <View style={styles.competitiveBadge}>
            <Text style={styles.badgeText}>
              The ONLY app with real-time AI coaching + universal translation
            </Text>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          {/* Call Wingman - Primary Feature */}
          <FeatureCard
            icon="📞"
            title="Call Wingman"
            tagline="AI whispers perfect responses in your ear during phone calls"
            features={[
              "Sales calls — close more deals",
              "Job interviews — nail every answer",
              "First dates — always charming",
              "Hard talks — stay calm & clear",
            ]}
            ctaText="Try Call Wingman"
            href="/call-wingman"
            accentColor="#00E5A0"
            isPrimary={true}
          />

          {/* Face-to-Face Link Mode - Custom component with dual CTAs */}
          <View style={styles.featureCard}>
            {/* Icon container */}
            <View style={[styles.iconContainer, { borderColor: "#818CF8" }]}>
              <Text style={styles.iconText}>🌍</Text>
            </View>

            {/* Content */}
            <Text style={styles.featureTitle}>Face-to-Face Link Mode</Text>
            <Text style={[styles.featureTagline, { color: "#818CF8" }]}>
              Send a link. They open it. Instant translation.
            </Text>

            {/* Feature list */}
            <View style={styles.featureList}>
              {[
                "No app download required",
                "Works anywhere in the world",
                "30+ languages supported",
                "Real-time voice translation",
              ].map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View
                    style={[styles.featureDot, { backgroundColor: "#818CF8" }]}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Dual CTA Buttons */}
            <View style={styles.dualCtaContainer}>
              {/* Share Link Button - Primary */}
              <Pressable
                style={({ pressed }) => [
                  styles.ctaButton,
                  styles.ctaButtonFlex,
                  { backgroundColor: "#818CF8" },
                  pressed && styles.ctaButtonPressed,
                  isSharing && styles.ctaButtonDisabled,
                ]}
                onPress={handleShareLink}
                disabled={isSharing}
                accessibilityRole="button"
                accessibilityLabel="Share link to start a conversation"
              >
                <Text style={styles.ctaText}>
                  {isSharing ? "Sharing..." : "Share Link"}
                </Text>
                <Text style={styles.ctaArrow}>🔗</Text>
              </Pressable>

              {/* Find Nearby Button - Secondary */}
              <Link href="/radar" asChild>
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButtonSecondary,
                    styles.ctaButtonFlex,
                    pressed && styles.ctaButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Find someone nearby via Bluetooth"
                >
                  <Text style={styles.ctaTextSecondary}>Nearby</Text>
                  <Text style={styles.ctaArrowSecondary}>📡</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>HOW IT WORKS</Text>

          <View style={styles.stepsContainer}>
            {/* Step 1 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Choose your mode</Text>
                <Text style={styles.stepDescription}>
                  Call Wingman for phone calls, Link Mode for face-to-face
                </Text>
              </View>
            </View>

            {/* Connector */}
            <View style={styles.stepConnector} />

            {/* Step 2 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Start talking</Text>
                <Text style={styles.stepDescription}>
                  AI listens and processes in real-time
                </Text>
              </View>
            </View>

            {/* Connector */}
            <View style={styles.stepConnector} />

            {/* Step 3 */}
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Get superpowers</Text>
                <Text style={styles.stepDescription}>
                  Perfect responses in your ear, or instant translation
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Social proof */}
        <View style={styles.socialProof}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>30+</Text>
              <Text style={styles.statLabel}>Languages</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{"<1s"}</Text>
              <Text style={styles.statLabel}>Latency</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>∞</Text>
              <Text style={styles.statLabel}>Possibilities</Text>
            </View>
          </View>
        </View>

        {/* Footer tagline */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Break language barriers. Master every conversation.
          </Text>
          <Text style={styles.footerSubtext}>Powered by advanced AI</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030507",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },

  // Hero
  hero: {
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 60 : 50,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#0A0E14",
    borderWidth: 2,
    borderColor: "#00E5A0",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  logoIcon: {
    fontSize: 36,
    fontWeight: "900",
    color: "#00E5A0",
    letterSpacing: -2,
  },
  logoGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 229, 160, 0.15)",
    zIndex: 1,
  },
  brandName: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 8,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 20,
  },
  competitiveBadge: {
    backgroundColor: "rgba(0, 229, 160, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 160, 0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: SCREEN_WIDTH - 48,
  },
  badgeText: {
    color: "#00E5A0",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },

  // Features Section
  featuresSection: {
    paddingHorizontal: 16,
    gap: 16,
  },
  featureCard: {
    backgroundColor: "#0A0E14",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    position: "relative",
    overflow: "hidden",
  },
  featureCardPrimary: {
    borderColor: "rgba(0, 229, 160, 0.3)",
  },
  cardGlow: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.1,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  iconText: {
    fontSize: 32,
    zIndex: 3,
  },
  pulseRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#00E5A0",
    zIndex: 1,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  featureTagline: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 20,
  },
  featureList: {
    gap: 10,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  ctaArrow: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "700",
  },
  dualCtaContainer: {
    flexDirection: "row",
    gap: 12,
  },
  ctaButtonFlex: {
    flex: 1,
  },
  ctaButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(129, 140, 248, 0.4)",
  },
  ctaTextSecondary: {
    color: "#818CF8",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  ctaArrowSecondary: {
    fontSize: 16,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },

  // How it works
  howItWorks: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.3)",
    letterSpacing: 2,
    marginBottom: 24,
  },
  stepsContainer: {
    gap: 0,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 229, 160, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 160, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#00E5A0",
    fontSize: 16,
    fontWeight: "700",
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  stepDescription: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 14,
    lineHeight: 20,
  },
  stepConnector: {
    width: 2,
    height: 32,
    backgroundColor: "rgba(0, 229, 160, 0.2)",
    marginLeft: 17,
    marginVertical: 4,
  },

  // Social proof
  socialProof: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#00E5A0",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.3)",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
