import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View, type TextInput } from "react-native";

import { isApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card } from "@/ui/primitives";
import { SocialButtons } from "@/ui/SocialButtons";
import { AppText } from "@/ui/Text";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherDevice, setOtherDevice] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOtherDevice(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      if (isApiError(e) && e.code === "device_in_use") {
        // The attempt is already recorded for an admin; show what to do next.
        setOtherDevice(e.otherDevice ?? "друго устройство");
      } else {
        setError(isApiError(e) ? e.message : "Входът е неуспешен. Опитай отново.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Добре дошъл отново"
      subtitle="Влез, за да видиш времето, цените и AI анализите за твоя регион."
    >
      <View style={{ gap: space.lg }}>
        {otherDevice ? (
          <Card style={{ gap: space.sm, borderColor: "#fde68a", backgroundColor: colors.amber50 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="phone-portrait-outline" size={20} color={colors.amber700} />
              <AppText variant="heading" tone="warn" style={{ flex: 1 }}>
                Профилът е активен на друго устройство
              </AppText>
            </View>
            <AppText variant="small" tone="warn">
              Профилът вече се използва на друго устройство ({otherDevice}). Излез от него или
              поискай одобрение от администратор. Опитът е записан.
            </AppText>
            <AppText variant="caption" tone="warn">
              След одобрение натисни „Вход“ отново.
            </AppText>
          </Card>
        ) : null}

        <View style={styles.card}>
          <FormMessage error={error} />

          <TextField
            label="Имейл"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="Въведи имейла си"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />

          <View style={{ gap: 10 }}>
            <TextField
              ref={passwordRef}
              label="Парола"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Въведи паролата"
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={visible ? "Скрий паролата" : "Покажи паролата"}
                  onPress={() => setVisible((v) => !v)}
                  hitSlop={8}
                  style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                >
                  <Icon name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                </Pressable>
              }
            />
            <Link href="/forgot-password" asChild>
              <Pressable accessibilityRole="link" hitSlop={8} style={{ alignSelf: "flex-end" }}>
                <AppText variant="caption" tone="brand" bold>
                  Забравена парола?
                </AppText>
              </Pressable>
            </Link>
          </View>

          <Button
            title="Вход"
            icon="log-in-outline"
            onPress={submit}
            loading={busy}
            disabled={!email.trim() || !password}
          />
        </View>

        <SocialButtons />

        <View style={styles.divider}>
          <View style={styles.rule} />
          <AppText variant="caption" tone="muted">
            Нямаш профил?
          </AppText>
          <View style={styles.rule} />
        </View>

        <Button
          title="Създай акаунт"
          icon="person-add-outline"
          variant="secondary"
          onPress={() => router.push("/register")}
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadowCard,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
