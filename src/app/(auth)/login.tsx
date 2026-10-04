import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { colors, space } from "@/theme/tokens";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherDevice, setOtherDevice] = useState<string | null>(null);

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
      title="Вход в AgroGrain"
      subtitle="Влез, за да видиш времето, цените и AI анализите за твоя регион."
    >
      <View style={{ gap: space.lg }}>
        {otherDevice ? (
          <Card style={{ gap: space.sm, borderColor: "#fde68a", backgroundColor: colors.amber50 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="phone-portrait-outline" size={20} color={colors.amber700} />
              <AppText variant="heading" tone="warn">
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

        <FormMessage error={error} />

        <TextField
          label="Имейл"
          value={email}
          onChangeText={setEmail}
          placeholder="ivan@ferma.bg"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
        />

        <View style={{ gap: 6 }}>
          <TextField
            label="Парола"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            suffix={undefined}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? "Скрий паролата" : "Покажи паролата"}
              onPress={() => setVisible((v) => !v)}
              hitSlop={8}
            >
              <AppText variant="caption" tone="muted" bold>
                {visible ? "Скрий паролата" : "Покажи паролата"}
              </AppText>
            </Pressable>
            <Link href="/forgot-password" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <AppText variant="caption" tone="muted" bold>
                  Забравена парола?
                </AppText>
              </Pressable>
            </Link>
          </View>
        </View>

        <Button
          title="Вход"
          onPress={submit}
          loading={busy}
          disabled={!email.trim() || !password}
        />

        <View style={{ alignItems: "center", paddingTop: space.sm }}>
          <AppText variant="caption" tone="muted">
            Нямаш профил?{" "}
            <Link href="/register" asChild>
              <AppText variant="caption" tone="brand" bold accessibilityRole="link">
                Създай акаунт
              </AppText>
            </Link>
          </AppText>
        </View>
      </View>
    </AuthLayout>
  );
}
