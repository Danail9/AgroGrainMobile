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

import { colors, space } from "@/theme/tokens";
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
        <View style={{ gap: space.md }}>
          <Logo />
          <View style={{ gap: 4 }}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="small" tone="muted">
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
  content: { paddingHorizontal: space.xl, gap: space.xl },
});
