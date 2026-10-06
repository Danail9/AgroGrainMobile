import { useState } from "react";
import { Alert, Switch, View } from "react-native";

import { isApiError } from "@/api/client";
import {
  changePassword,
  deleteAccount,
  useRegions,
  useUpdatePrefs,
  useUpdateProfile,
  useUpdateRegion,
} from "@/api/queries";
import type { Me } from "@/api/schemas";
import { useAuth } from "@/auth/AuthContext";
import { normalizeDecimal } from "@/lib/forms";
import { PHONE_CODES, splitPhone } from "@/lib/phone";
import { disablePush, enablePush, pushSupported } from "@/lib/push";
import { colors, space } from "@/theme/tokens";
import { Button, ChoiceGroup, FormMessage, TextField } from "@/ui/forms";
import { Divider } from "@/ui/primitives";
import { RegionPicker, type RegionValue } from "@/ui/RegionPicker";
import { AppText } from "@/ui/Text";

type Errors = Partial<Record<string, string>>;

function failure(e: unknown, known: string[]): { form?: string; field?: Errors } {
  if (isApiError(e) && e.field && known.includes(e.field)) return { field: { [e.field]: e.message } };
  return { form: isApiError(e) ? e.message : "Записът е неуспешен. Опитай отново." };
}

export function ProfileForm({ user }: { user: Me["user"] }) {
  const update = useUpdateProfile();
  const initial = splitPhone(user.phone);
  const [name, setName] = useState(user.name);
  const [farmName, setFarmName] = useState(user.farmName ?? "");
  const [phoneCode, setPhoneCode] = useState(initial.code);
  const [phone, setPhone] = useState(initial.local);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});

  function save() {
    setError(null);
    setSuccess(null);
    setFields({});
    update.mutate(
      { name, farmName, phone, phoneCode },
      {
        onSuccess: () => setSuccess("Профилът е обновен."),
        onError: (e) => {
          const f = failure(e, ["name", "farmName", "phone"]);
          setError(f.form ?? null);
          setFields(f.field ?? {});
        },
      },
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <FormMessage error={error} success={success} />
      <TextField label="Име и фамилия" value={name} onChangeText={setName} error={fields.name} />
      <TextField
        label="Стопанство (по избор)"
        value={farmName}
        onChangeText={setFarmName}
        placeholder="ЗП Добруджа"
        error={fields.farmName}
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
        keyboardType="phone-pad"
        error={fields.phone}
      />
      <Button title="Запази" onPress={save} loading={update.isPending} />
    </View>
  );
}

export function PasswordForm() {
  const { adoptSession } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});

  async function save() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setFields({});
    try {
      const result = await changePassword({ current, password, confirm });
      // Every other device was signed out; this phone carries on with a new session.
      await adoptSession({ token: result.token, expiresAt: result.expiresAt });
      setCurrent("");
      setPassword("");
      setConfirm("");
      setSuccess("Паролата е сменена. Другите устройства са изведени.");
    } catch (e) {
      const f = failure(e, ["current", "password", "confirm"]);
      setError(f.form ?? null);
      setFields(f.field ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <FormMessage error={error} success={success} />
      <TextField
        label="Текуща парола"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        placeholder="••••••••"
        error={fields.current}
      />
      <TextField
        label="Нова парола"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Поне 8 символа"
        error={fields.password}
      />
      <TextField
        label="Повтори новата парола"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        placeholder="••••••••"
        error={fields.confirm}
      />
      <Button
        title="Смени паролата"
        onPress={() => void save()}
        loading={busy}
        disabled={!current || !password}
      />
      <AppText variant="caption" tone="muted">
        След смяна ще останеш вписан тук, а другите устройства ще бъдат изведени.
      </AppText>
    </View>
  );
}

/** Required by the stores: the account can be erased from inside the app. */
export function DeleteAccountForm() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});

  async function erase() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await deleteAccount({ password });
      await signOut();
    } catch (e) {
      const f = failure(e, ["password"]);
      setError(f.form ?? null);
      setFields(f.field ?? {});
      setBusy(false);
    }
  }

  function confirm() {
    Alert.alert(
      "Изтриване на профила",
      "Профилът и всички твои данни ще бъдат изтрити окончателно. Това не може да се върне.",
      [
        { text: "Отказ", style: "cancel" },
        { text: "Изтрий", style: "destructive", onPress: () => void erase() },
      ],
    );
  }

  if (!open) {
    return (
      <View style={{ gap: space.md }}>
        <AppText variant="caption" tone="muted">
          Изтрива профила ти и всичките му данни окончателно.
        </AppText>
        <Button title="Изтрий профила" variant="danger" icon="trash-outline" onPress={() => setOpen(true)} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <FormMessage error={error} success={null} />
      <TextField
        label="Паролата ти"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="••••••••"
        error={fields.password}
      />
      <Button
        title="Изтрий профила окончателно"
        variant="danger"
        icon="trash-outline"
        loading={busy}
        disabled={!password}
        onPress={confirm}
      />
      <Button title="Отказ" variant="secondary" disabled={busy} onPress={() => setOpen(false)} />
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="small" bold>
          {label}
        </AppText>
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand[500], false: colors.line }}
        thumbColor={colors.white}
      />
    </View>
  );
}

/**
 * Alert preferences. Each switch saves on its own; the threshold saves from
 * its button. The phone-alerts switch only appears in builds that can receive
 * push (not Expo Go).
 */
export function NotificationPrefsForm({ prefs }: { prefs: Me["notificationPrefs"] }) {
  const update = useUpdatePrefs();
  const [threshold, setThreshold] = useState(String(prefs.priceThreshold));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const save = (patch: Parameters<typeof update.mutate>[0], message: string) => {
    setError(null);
    setSuccess(null);
    update.mutate(patch, {
      onSuccess: () => setSuccess(message),
      onError: (e) => setError(isApiError(e) ? e.message : "Записът е неуспешен. Опитай отново."),
    });
  };

  async function setPush(push: boolean) {
    setError(null);
    setSuccess(null);
    try {
      if (push && !(await enablePush())) {
        setError("Разреши известията за AgroGrain от настройките на телефона.");
        return;
      }
      if (!push) await disablePush();
    } catch {
      setError("Известията на телефона не могат да се променят в момента.");
      return;
    }
    save({ push }, "Настройките са запазени.");
  }

  return (
    <View>
      <FormMessage error={error} success={success} />
      {pushSupported() ? (
        <>
          <Toggle
            label="Известия на телефона"
            hint="Получавай алармите като известия, дори когато приложението е затворено."
            value={prefs.push}
            onChange={(push) => void setPush(push)}
          />
          <Divider />
        </>
      ) : null}
      <Toggle
        label="Промяна в цените"
        hint="Когато дневната промяна надвиши прага по-долу."
        value={prefs.priceMove}
        onChange={(priceMove) => save({ priceMove }, "Настройките са запазени.")}
      />
      <Divider />
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md, paddingVertical: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Праг на промяната"
            suffix="%"
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ width: 110 }}>
          <Button
            compact
            variant="secondary"
            title="Запази"
            loading={update.isPending}
            onPress={() =>
              save({ priceThreshold: Number(normalizeDecimal(threshold)) }, "Настройките са запазени.")
            }
          />
        </View>
      </View>
      <Divider />
      <Toggle
        label="Очаквани валежи"
        hint="Вероятност за валежи над 60% днес или утре."
        value={prefs.heavyRain}
        onChange={(heavyRain) => save({ heavyRain }, "Настройките са запазени.")}
      />
      <Divider />
      <Toggle
        label="Ниски температури"
        hint="Минимална температура до 2°C."
        value={prefs.frost}
        onChange={(frost) => save({ frost }, "Настройките са запазени.")}
      />
      <Divider />
      <Toggle
        label="Силен вятър"
        hint="Пориви над 25 км/ч — рисково за пръскане."
        value={prefs.strongWind}
        onChange={(strongWind) => save({ strongWind }, "Настройките са запазени.")}
      />
      <Divider />
      <Toggle
        label="Подходящи дни за работа"
        hint="Когато се отвори добър прозорец за полска работа."
        value={prefs.goodFieldWork}
        onChange={(goodFieldWork) => save({ goodFieldWork }, "Настройките са запазени.")}
      />
    </View>
  );
}

export function RegionForm({ user }: { user: Me["user"] }) {
  const update = useUpdateRegion();
  const regions = useRegions();
  const [value, setValue] = useState<RegionValue>({
    regionSlug: user.regionSlug,
    settlement: user.settlement ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const regionName =
    regions.data?.regions.find((region) => region.slug === value.regionSlug)?.name ?? user.regionName;

  return (
    <View style={{ gap: space.md }}>
      <FormMessage error={error} success={success} />
      <RegionPicker value={value} regionName={regionName} onChange={setValue} />
      <Button
        title="Запази"
        loading={update.isPending}
        onPress={() => {
          setError(null);
          setSuccess(null);
          update.mutate(value, {
            onSuccess: () => setSuccess("Регионът е обновен."),
            onError: (e) =>
              setError(isApiError(e) ? e.message : "Записът е неуспешен. Опитай отново."),
          });
        }}
      />
      <AppText variant="caption" tone="muted">
        Регионът определя прогнозата за времето и регионалните цени.
      </AppText>
    </View>
  );
}
