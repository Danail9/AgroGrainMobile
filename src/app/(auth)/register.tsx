import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { isApiError } from "@/api/client";
import { useRegions } from "@/api/queries";
import { useAuth } from "@/auth/AuthContext";
import { DEFAULT_PHONE_CODE, PHONE_CODES } from "@/lib/phone";
import { colors, radius, space } from "@/theme/tokens";
import { AuthLayout } from "@/ui/AuthLayout";
import { Button, ChoiceGroup, FormMessage, TextField } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import { RegionPicker, type RegionValue } from "@/ui/RegionPicker";
import { AppText } from "@/ui/Text";

type Role = "FARMER" | "TRADER";

const ACCOUNT_TYPES: {
  value: Role;
  label: string;
  hint: string;
  icon: IconName;
  nameLabel: string;
  namePlaceholder: string;
}[] = [
  {
    value: "FARMER",
    label: "Фермер",
    hint: "Продавам продукция",
    icon: "leaf",
    nameLabel: "Стопанство",
    namePlaceholder: "ЗП Добруджа",
  },
  {
    value: "TRADER",
    label: "Търговец",
    hint: "Купувам и публикувам цени",
    icon: "swap-horizontal",
    nameLabel: "Фирма",
    namePlaceholder: "АгроТрейд ЕООД",
  },
];

const FIELDS = ["name", "farmName", "phone", "email", "password", "confirm"] as const;
type FieldName = (typeof FIELDS)[number];

export default function RegisterScreen() {
  const { register } = useAuth();
  const regions = useRegions();

  const [role, setRole] = useState<Role>("FARMER");
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

  const account = ACCOUNT_TYPES.find((type) => type.value === role) ?? ACCOUNT_TYPES[0];
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

        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="muted" bold>
            Тип профил
          </AppText>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {ACCOUNT_TYPES.map((type) => {
              const selected = type.value === role;
              return (
                <Pressable
                  key={type.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setRole(type.value)}
                  style={[styles.typeCard, selected && styles.typeCardSelected]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name={type.icon} size={16} color={colors.brand[700]} />
                    <AppText variant="small" bold>
                      {type.label}
                    </AppText>
                  </View>
                  <AppText variant="caption" tone="muted">
                    {type.hint}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

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

const styles = StyleSheet.create({
  typeCard: {
    flex: 1,
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeCardSelected: { borderColor: colors.brand[600], backgroundColor: colors.brand[50] },
});
