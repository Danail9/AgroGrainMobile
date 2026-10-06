import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";

import { api, isApiError } from "@/api/client";
import { colors, space } from "@/theme/tokens";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

const resetSchema = z.object({ reset: z.boolean() });

/** Opened from the emailed link (universal link or `agrograin://reset-password?token=…`). */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Partial<Record<string, string>>>({});
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldError({});
    try {
      await api("/auth/password/reset", {
        method: "POST",
        body: { token, password, confirm },
        schema: resetSchema,
        auth: false,
      });
      setDone(true);
    } catch (e) {
      if (isApiError(e) && (e.field === "password" || e.field === "confirm")) {
        setFieldError({ [e.field]: e.message });
      } else {
        setError(isApiError(e) ? e.message : "Паролата не е сменена. Опитай отново.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Невалиден линк" subtitle="Линкът за смяна на парола е непълен или изтекъл.">
        <Link href="/forgot-password" asChild>
          <AppText variant="small" tone="brand" bold align="center" accessibilityRole="link">
            Поискай нов линк
          </AppText>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Нова парола" subtitle="Избери парола, с която ще влизаш в AgroGrain.">
      {done ? (
        <View style={{ gap: space.lg }}>
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              gap: 8,
              backgroundColor: colors.brand[50],
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Icon name="checkmark-circle-outline" size={18} color={colors.brand[700]} />
            <AppText variant="small" bold style={{ flex: 1, color: colors.brand[700] }}>
              Паролата е сменена. Можеш да влезеш с новата парола.
            </AppText>
          </View>
          <Link href="/login" asChild>
            <Button title="Към вход" onPress={() => undefined} />
          </Link>
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
          <FormMessage error={error} />
          <TextField
            label="Нова парола"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Поне 8 символа"
            error={fieldError.password}
          />
          <TextField
            label="Повтори паролата"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="••••••••"
            error={fieldError.confirm}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Button title="Запази паролата" onPress={submit} loading={busy} disabled={!password || !confirm} />
        </View>
      )}
    </AuthLayout>
  );
}
