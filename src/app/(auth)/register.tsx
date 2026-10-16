import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { isApiError } from "@/api/client";
import { useRegions } from "@/api/queries";
import { useAuth } from "@/auth/AuthContext";
import { DEFAULT_PHONE_CODE, PHONE_CODES } from "@/lib/phone";
import { space } from "@/theme/tokens";
import { AccountTypePicker, accountType, type AccountRole } from "@/ui/AccountType";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, ChoiceGroup, FormMessage, TextField } from "@/ui/forms";
import { LegalLinks } from "@/ui/LegalLinks";
import { SocialButtons } from "@/ui/SocialButtons";
import { RegionPicker, type RegionValue } from "@/ui/RegionPicker";
import { AppText } from "@/ui/Text";

const FIELDS = ["name", "farmName", "phone", "email", "password", "confirm"] as const;
type FieldName = (typeof FIELDS)[number];

export default function RegisterScreen() {
  const { register } = useAuth();
  const regions = useRegions();

  const [role, setRole] = useState<AccountRole>("FARMER");
  const [name, setName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_CODE);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [region, setRegion] = useState<RegionValue>({ regionSlug: "dobrich", settlement: "" });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const account = accountType(role);
  const regionName =
    regions.data?.regions.find((item) => item.slug === region.regionSlug)?.name ?? "Добрич";

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await register({
        name,
        email: email.trim(),
        password,
        confirm,
        farmName,
        phoneCode,
        phone,
        role,
        regionSlug: region.regionSlug,
        settlement: region.settlement,
      });
    } catch (e) {
      if (isApiError(e) && e.field && (FIELDS as readonly string[]).includes(e.field)) {
        setFieldErrors({ [e.field]: e.message });
      } else {
        setError(isApiError(e) ? e.message : "Регистрацията е неуспешна. Опитай отново.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Създай профил" subtitle="Отнема по-малко от минута.">
      <View style={{ gap: space.md }}>
        <FormMessage error={error} />

        <SocialButtons dividerLabel="или с имейл" dividerBelow />

        <AccountTypePicker value={role} onChange={setRole} />
        {role === "TRADER" ? (
          <AppText variant="caption" tone="brand">
            1 месец безплатен пълен достъп след регистрация, без карта и без автоматично таксуване. След това е нужен платен план.
          </AppText>
        ) : null}

        <TextField
          label="Име и фамилия"
          value={name}
          onChangeText={setName}
          placeholder="Иван Петров"
          autoComplete="name"
          textContentType="name"
          error={fieldErrors.name}
        />

        <TextField
          label={account.nameLabel}
          value={farmName}
          onChangeText={setFarmName}
          placeholder={account.namePlaceholder}
          maxLength={120}
          error={fieldErrors.farmName}
        />

        <ChoiceGroup
          label="Код на държава"
          options={PHONE_CODES.map((code) => ({ value: code, label: code }))}
          value={phoneCode}
          onChange={setPhoneCode}
        />
        <TextField
          label="Телефон"
          value={phone}
          onChangeText={setPhone}
          placeholder="888 123 456"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={fieldErrors.phone}
        />

        <RegionPicker value={region} regionName={regionName} onChange={setRegion} />

        <TextField
          label="Имейл"
          value={email}
          onChangeText={setEmail}
          placeholder="ivan@ferma.bg"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          error={fieldErrors.email}
        />

        <TextField
          label="Парола"
          value={password}
          onChangeText={setPassword}
          placeholder="Поне 8 символа"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={fieldErrors.password}
        />
        <TextField
          label="Повтори паролата"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={fieldErrors.confirm}
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <View style={{ paddingTop: space.sm }}>
          <Button
            title="Създай профил"
            onPress={submit}
            loading={busy}
            disabled={!name || !email.trim() || !password}
          />
        </View>

        <AppText variant="caption" tone="muted" align="center">
          Със създаването на профил приемаш Общите условия и Политиката за поверителност.
        </AppText>
        <LegalLinks />

        <View style={{ alignItems: "center", paddingTop: space.sm }}>
          <AppText variant="caption" tone="muted">
            Вече имаш профил?{" "}
            <Link href="/login" asChild>
              <AppText variant="caption" tone="brand" bold accessibilityRole="link">
                Влез
              </AppText>
            </Link>
          </AppText>
        </View>
      </View>
    </AuthLayout>
  );
}
