import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { isApiError } from "@/api/client";
import { useRegions } from "@/api/queries";
import { useAuth } from "@/auth/AuthContext";
import { DEFAULT_PHONE_CODE } from "@/lib/phone";
import { colors, radius, space } from "@/theme/tokens";
import { AccountTypePicker, accountType, type AccountRole } from "@/ui/AccountType";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { LegalLinks } from "@/ui/LegalLinks";
import { RegionPicker, type RegionValue } from "@/ui/RegionPicker";
import { PhoneField } from "@/ui/SettingsForms";
import { AppText } from "@/ui/Text";

const FIELDS = ["name", "farmName", "phone"] as const;
type FieldName = (typeof FIELDS)[number];

/** Second step after Google/Apple sign-in for someone without an account yet. */
export default function CompleteProfileScreen() {
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const { completeSocialProfile, hasPendingSocial } = useAuth();
  const regions = useRegions();

  const [pending] = useState(hasPendingSocial);
  const [role, setRole] = useState<AccountRole>("FARMER");
  const [name, setName] = useState(params.name ?? "");
  const [farmName, setFarmName] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_CODE);
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<RegionValue>({ regionSlug: "dobrich", settlement: "" });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const account = accountType(role);
  const regionName =
    regions.data?.regions.find((item) => item.slug === region.regionSlug)?.name ?? "Добрич";

  if (!pending) {
    return (
      <AuthLayout title="Сесията изтече" subtitle="Започни отново входа с Google или Apple.">
        <Button title="Към входа" icon="log-in-outline" onPress={() => router.replace("/login")} />
      </AuthLayout>
    );
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await completeSocialProfile({
        name: name.trim(),
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
        setError(isApiError(e) ? e.message : "Профилът не беше създаден. Опитай отново.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Завърши профила" subtitle="Още няколко данни и си готов.">
      <View style={{ gap: space.md }}>
        {params.email ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: colors.brand[50],
            }}
          >
            <Icon name="checkmark-circle" size={18} color={colors.brand[700]} />
            <AppText variant="small" style={{ flex: 1 }} numberOfLines={1}>
              {params.email}
            </AppText>
          </View>
        ) : null}

        <FormMessage error={error} />

        <AccountTypePicker value={role} onChange={setRole} />

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

        <PhoneField
          code={phoneCode}
          onCode={setPhoneCode}
          value={phone}
          onChange={setPhone}
          error={fieldErrors.phone}
        />

        <RegionPicker value={region} regionName={regionName} onChange={setRegion} />

        <View style={{ paddingTop: space.sm }}>
          <Button
            title="Създай профил"
            icon="checkmark"
            onPress={submit}
            loading={busy}
            disabled={!name.trim()}
          />
        </View>

        <AppText variant="caption" tone="muted" align="center">
          Със създаването на профил приемаш Общите условия и Политиката за поверителност.
        </AppText>
        <LegalLinks />

        <Button title="Назад" variant="ghost" onPress={() => router.back()} />
      </View>
    </AuthLayout>
  );
}
