import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, shadowCard, space } from "@/theme/tokens";
import { AppText } from "@/ui/Text";

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="AgroGrain"
      source={require("../../assets/logo.png")}
      style={{ width: size, height: size * (514 / 593) }}
      resizeMode="contain"
    />
  );
}

/** Shared frame for the sign-in, registration and password-reset screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoTile}>
            <Logo size={52} />
          </View>
          <AppText variant="caption" bold style={styles.wordmark}>
            AGROGRAIN
          </AppText>
          <View style={{ gap: 6, alignItems: "center" }}>
            <AppText variant="title" align="center" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="small" tone="muted" align="center" style={{ maxWidth: 320 }}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.xl },
  hero: { alignItems: "center", gap: space.sm, paddingTop: space.lg },
  logoTile: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadowCard,
  },
  wordmark: { color: colors.brand[700], letterSpacing: 2, marginTop: 4 },
});
