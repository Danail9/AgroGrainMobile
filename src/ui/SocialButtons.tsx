import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { isApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  isAppleAvailable,
  isGoogleConfigured,
  signInWithApple,
  signInWithGoogle,
  SocialSignInError,
  type SocialCredential,
} from "@/lib/social-sign-in";
import { colors, radius, space } from "@/theme/tokens";
import { Button, FormMessage } from "@/ui/forms";
import { AppText } from "@/ui/Text";

/** "Continue with Google/Apple"; renders nothing when neither is available. */
export function SocialButtons({
  dividerLabel = "или",
  dividerBelow = false,
}: {
  dividerLabel?: string;
  /** Put the divider after the buttons (when they sit above an email form). */
  dividerBelow?: boolean;
}) {
  const { socialSignIn } = useAuth();
  const [google] = useState(isGoogleConfigured);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void isAppleAvailable().then((available) => {
      if (alive) setApple(available);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!google && !apple) return null;

  async function run(provider: "google" | "apple", start: () => Promise<SocialCredential | null>) {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      const credential = await start();
      if (!credential) return;
      const outcome = await socialSignIn(credential);
      if (outcome.status === "needsProfile") {
        router.push({
          pathname: "/complete-profile",
          params: { email: outcome.email, name: outcome.name ?? "" },
        });
      }
    } catch (e) {
      if (e instanceof SocialSignInError) setError(e.message);
      else if (isApiError(e) && e.code === "device_in_use") {
        setError(
          `Профилът вече се използва на друго устройство (${e.otherDevice ?? "друго устройство"}). Излез от него или поискай одобрение от администратор.`,
        );
      } else setError(isApiError(e) ? e.message : "Входът е неуспешен. Опитай отново.");
    } finally {
      setBusy(null);
    }
  }

  const divider = (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <AppText variant="caption" tone="muted">
        {dividerLabel}
      </AppText>
      <View style={styles.rule} />
    </View>
  );

  return (
    <View style={{ gap: space.sm }}>
      {dividerBelow ? null : divider}

      <FormMessage error={error} />

      {apple ? (
        <View pointerEvents={busy ? "none" : "auto"} style={{ opacity: busy === "apple" ? 0.6 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.lg}
            style={{ height: 50, width: "100%" }}
            onPress={() => void run("apple", signInWithApple)}
          />
        </View>
      ) : null}

      {google ? (
        <Button
          title="Продължи с Google"
          icon="logo-google"
          variant="secondary"
          loading={busy === "google"}
          disabled={busy !== null && busy !== "google"}
          onPress={() => void run("google", signInWithGoogle)}
        />
      ) : null}

      {dividerBelow ? divider : null}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
