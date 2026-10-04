import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";

import { api, isApiError } from "@/api/client";
import { colors, space } from "@/theme/tokens";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

const sentSchema = z.object({ sent: z.boolean() });

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/auth/password/forgot", {
        method: "POST",
        body: { email: email.trim() },
        schema: sentSchema,
        auth: false,
      });
      setSent(true);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Заявката е неуспешна. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Забравена парола"
      subtitle="Въведи имейла си и ще ти изпратим линк за нова парола."
    >
      {sent ? (
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
            <Icon name="mail-open-outline" size={18} color={colors.brand[700]} />
            <AppText variant="small" bold style={{ flex: 1, color: colors.brand[700] }}>
              Ако има профил с този имейл, изпратихме линк за смяна на паролата. Провери и папката
              със спам.
            </AppText>
          </View>
          <Link href="/login" asChild>
            <AppText variant="small" tone="brand" bold align="center" accessibilityRole="link">
              Обратно към вход
            </AppText>
          </Link>
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
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
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Button title="Изпрати линк" onPress={submit} loading={busy} disabled={!email.trim()} />
          <Link href="/login" asChild>
            <AppText variant="caption" tone="brand" bold align="center" accessibilityRole="link">
              Обратно към вход
            </AppText>
          </Link>
        </View>
      )}
    </AuthLayout>
  );
}
