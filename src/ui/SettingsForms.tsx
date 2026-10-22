import { useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";

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
import { PHONE_CODES, PHONE_COUNTRIES, phoneInput, splitPhone } from "@/lib/phone";
import { disablePush, enablePush, pushSupported, pushUnavailableReason } from "@/lib/push";
import { colors, radius, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { Button, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Divider, pressedStyle } from "@/ui/primitives";
import { RegionPicker, type RegionValue } from "@/ui/RegionPicker";
import { AppText } from "@/ui/Text";

type Errors = Partial<Record<string, string>>;

function failure(e: unknown, known: string[]): { form?: string; field?: Errors } {
  if (isApiError(e) && e.field && known.includes(e.field)) return { field: { [e.field]: e.message } };
  return { form: isApiError(e) ? e.message : "Записът е неуспешен. Опитай отново." };
}

export function ProfileForm({ user, onSaved }: { user: Me["user"]; onSaved?: () => void }) {
  const update = useUpdateProfile();
  const initial = splitPhone(user.phone);
  const [name, setName] = useState(user.name);
  const [farmName, setFarmName] = useState(user.farmName ?? "");
  const [phoneCode, setPhoneCode] = useState(initial.code);
  const [phone, setPhone] = useState(initial.local);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});

  const changed =
    name.trim() !== user.name ||
    farmName.trim() !== (user.farmName ?? "") ||
    phoneCode !== initial.code ||
    phone.trim() !== initial.local;

  function save() {
    setError(null);
    setSuccess(null);
    setFields({});
    update.mutate(
      { name, farmName, phone, phoneCode },
      {
        onSuccess: () => {
          setSuccess("Профилът е обновен.");
          onSaved?.();
        },
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
      <TextField
        label="Име и фамилия"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        error={fields.name}
      />
      <TextField
        label="Стопанство / фирма (по избор)"
        value={farmName}
        onChangeText={setFarmName}
        placeholder="ЗП Добруджа"
        error={fields.farmName}
      />
      <PhoneField
        code={phoneCode}
        onCode={setPhoneCode}
        value={phone}
        onChange={setPhone}
        error={fields.phone}
      />
      <Button
        title={changed ? "Запази промените" : "Няма промени"}
        icon="checkmark"
        onPress={save}
        loading={update.isPending}
        disabled={!changed || !name.trim()}
      />
    </View>
  );
}

/** Phone number with its dial code as a tappable prefix instead of a row of chips. */
export function PhoneField({
  code,
  onCode,
  value,
  onChange,
  error,
}: {
  code: string;
  onCode: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const country = PHONE_COUNTRIES[code];

  return (
    <View>
      <AppText variant="caption" tone="muted" bold style={{ marginBottom: 6 }}>
        Телефон
      </AppText>
      <View style={[styles.phone, focused && { borderColor: colors.brand[500] }, !!error && { borderColor: colors.down }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Код на държава ${code}. Промени`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.codeButton, pressed && pressedStyle]}
        >
          <AppText style={{ fontSize: 18 }}>{country?.flag ?? "🌐"}</AppText>
          <AppText variant="small" bold>
            {code}
          </AppText>
          <Icon name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          accessibilityLabel="Телефон"
          value={value}
          onChangeText={(text) => onChange(phoneInput(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="888 123 456"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={16}
          style={styles.phoneInput}
        />
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
        Търговците виждат номера ти, за да се свържат за обявите.
      </AppText>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Затвори" style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <AppText variant="small" bold style={{ padding: space.lg, paddingBottom: space.sm }}>
              Код на държава
            </AppText>
            {PHONE_CODES.map((item) => {
              const selected = item === code;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onCode(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.menuRow, pressed && pressedStyle]}
                >
                  <AppText style={{ fontSize: 20 }}>{PHONE_COUNTRIES[item]?.flag ?? "🌐"}</AppText>
                  <AppText variant="small" bold={selected} style={{ flex: 1 }}>
                    {PHONE_COUNTRIES[item]?.name ?? item}
                  </AppText>
                  <AppText variant="small" tone="muted" numeric>
                    {item}
                  </AppText>
                  {selected ? <Icon name="checkmark" size={18} color={colors.brand[600]} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? "Скрий паролата" : "Покажи паролата"}
      hitSlop={8}
      onPress={onToggle}
      style={{ paddingHorizontal: 14 }}
    >
      <Icon name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
    </Pressable>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon
        name={ok ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={ok ? colors.brand[600] : colors.muted}
      />
      <AppText variant="caption" tone={ok ? "brand" : "muted"}>
        {label}
      </AppText>
    </View>
  );
}

export function PasswordForm() {
  const { adoptSession } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});

  const longEnough = password.length >= 8;
  const matches = !!password && password === confirm;

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

  const toggle = <PasswordToggle visible={show} onToggle={() => setShow((value) => !value)} />;

  return (
    <View style={{ gap: space.md }}>
      <FormMessage error={error} success={success} />
      <TextField
        label="Текуща парола"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        placeholder="••••••••"
        error={fields.current}
        accessory={toggle}
      />
      <TextField
        label="Нова парола"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Поне 8 символа"
        error={fields.password}
        accessory={toggle}
      />
      <TextField
        label="Повтори новата парола"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="••••••••"
        error={fields.confirm}
        accessory={toggle}
      />
      {password ? (
        <View style={{ gap: 4 }}>
          <Check ok={longEnough} label="Поне 8 символа" />
          <Check ok={matches} label="Паролите съвпадат" />
        </View>
      ) : null}
      <Button
        title="Смени паролата"
        icon="lock-closed-outline"
        onPress={() => void save()}
        loading={busy}
        disabled={!current || !longEnough || !matches}
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
    showDialog({
      title: "Изтриване на профила",
      message: "Профилът и всички твои данни ще бъдат изтрити окончателно. Това не може да се върне. Ако имаш Apple абонамент, първо го спри в App Store. Изтриването на профила не спира Apple таксуването.",
      icon: "trash-outline",
      tone: "danger",
      dismissable: true,
      actions: [
        { label: "Отказ", style: "cancel" },
        { label: "Изтрий", style: "destructive", onPress: () => void erase() },
      ],
    });
  }

  if (!open) {
    return (
      <View style={{ gap: space.md }}>
        <AppText variant="caption" tone="muted">
          Изтрива профила ти и всичките му данни окончателно.
          Apple абонаментът не се прекратява автоматично. Спри го в App Store преди изтриване.
        </AppText>
        <FormMessage error={error} />
        <Button title="Абонаменти в App Store" variant="secondary"
          onPress={() => void Linking.openURL("https://apps.apple.com/account/subscriptions").catch((e: unknown) =>
            setError(e instanceof Error ? e.message : "App Store не може да се отвори."))} />
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
  disabled = false,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
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
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand[500], false: colors.line }}
        thumbColor={colors.white}
      />
    </View>
  );
}

/**
 * Each switch saves on its own. The phone-alerts switch only appears in
 * builds that can receive push (not Expo Go).
 */
export function NotificationPrefsForm({ prefs, role }: {
  prefs: Me["notificationPrefs"];
  role: Me["user"]["role"];
}) {
  const update = useUpdatePrefs();
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
      <Toggle
        label="Всички известия"
        hint="Спира новите известия в приложението и на телефона, без да променя настройките по категории."
        value={prefs.enabled}
        disabled={update.isPending}
        onChange={(enabled) => save({ enabled }, enabled ? "Известията са включени." : "Известията са спрени.")}
      />
      <AppText variant="caption" tone="muted">
        Старите известия остават в историята. Имейлите за плащания и потвържденията на екрана не се спират.
      </AppText>
      <Divider />
      <View pointerEvents={update.isPending || !prefs.enabled ? "none" : "auto"} style={{ opacity: prefs.enabled ? 1 : 0.5 }}>
      {pushSupported() ? (
        <>
          <Toggle
            label="Известия на телефона"
            hint="Получавай алармите като известия, дори когато приложението е затворено."
            value={prefs.push}
            disabled={!prefs.enabled || update.isPending}
            onChange={(push) => void setPush(push)}
          />
          <Divider />
        </>
      ) : (
        <AppText variant="caption" tone="muted" style={{ marginVertical: space.md }}>
          {pushUnavailableReason()}
        </AppText>
      )}
      <AppText variant="small" bold>Цени</AppText>
      <Toggle
        label="Актуализации на цените"
        hint="При промяна на цените на култури и торове. Едно известие за всяко запазване, включително масово."
        value={prefs.priceMove}
        disabled={!prefs.enabled || update.isPending}
        onChange={(priceMove) => save({ priceMove }, "Настройките са запазени.")}
      />
      <Divider />
      <AppText variant="small" bold>Време и полска работа</AppText>
      <Toggle
        label="Очаквани валежи"
        hint="Вероятност за валежи над 60% днес или утре."
        value={prefs.heavyRain}
        disabled={!prefs.enabled || update.isPending}
        onChange={(heavyRain) => save({ heavyRain }, "Настройките са запазени.")}
      />
      <Divider />
      <Toggle
        label="Ниски температури"
        hint="Минимална температура до 2°C."
        value={prefs.frost}
        disabled={!prefs.enabled || update.isPending}
        onChange={(frost) => save({ frost }, "Настройките са запазени.")}
      />
      <Divider />
      <Toggle
        label="Силен вятър"
        hint="Пориви над 25 км/ч — рисково за пръскане."
        value={prefs.strongWind}
        disabled={!prefs.enabled || update.isPending}
        onChange={(strongWind) => save({ strongWind }, "Настройките са запазени.")}
      />
      <Divider />
      <Toggle
        label="Подходящи дни за работа"
        hint="Когато се отвори добър прозорец за полска работа."
        value={prefs.goodFieldWork}
        disabled={!prefs.enabled || update.isPending}
        onChange={(goodFieldWork) => save({ goodFieldWork }, "Настройките са запазени.")}
      />
      {role !== "ADMIN" ? <>
      <Divider />
      <AppText variant="small" bold>Борса</AppText>
      {role === "FARMER" ? <Toggle
        label="Нови оферти в Борса"
        hint="Оферти от търговци към стопани."
        value={prefs.newOffer}
        disabled={!prefs.enabled || update.isPending}
        onChange={(newOffer) => save({ newOffer }, "Настройките са запазени.")}
      /> : null}
      {role === "TRADER" ? <Toggle
        label="Нови обяви в Борса"
        hint="Обяви от стопани към търговци."
        value={prefs.newListing}
        disabled={!prefs.enabled || update.isPending}
        onChange={(newListing) => save({ newListing }, "Настройките са запазени.")}
      /> : null}
      {role === "TRADER" ? <Toggle
        label="Изтичащи оферти"
        hint="Ден преди твоя оферта да изтече, за да я удължиш."
        value={prefs.offerExpiring ?? true}
        disabled={!prefs.enabled || update.isPending}
        onChange={(offerExpiring) => save({ offerExpiring }, "Настройките са запазени.")}
      /> : null}
      <Toggle
        label="Промени в запазени"
        hint="Когато запазена оферта или обява бъде спряна, удължена или затворена."
        value={prefs.savedItems ?? true}
        disabled={!prefs.enabled || update.isPending}
        onChange={(savedItems) => save({ savedItems }, "Настройките са запазени.")}
      />
      </> : null}
      <Divider />
      <AppText variant="small" bold>Абонамент</AppText>
      <Toggle
        label="Надграждане на абонамента"
        hint="Известие при успешно надграждане на плана."
        value={prefs.subscriptionUpgrade}
        disabled={!prefs.enabled || update.isPending}
        onChange={(subscriptionUpgrade) => save({ subscriptionUpgrade }, "Настройките са запазени.")}
      />
      <Toggle
        label="Напомняне за абонамента"
        hint="7 дни преди изтичане или автоматично подновяване."
        value={prefs.subscriptionReminder}
        disabled={!prefs.enabled || update.isPending}
        onChange={(subscriptionReminder) => save({ subscriptionReminder }, "Настройките са запазени.")}
      />
      <Divider />
      <AppText variant="small" bold>Имейл</AppText>
      <Toggle
        label="Седмичен обзор"
        hint="Всеки понеделник: цени на любимите ти култури, времето и новото в Борса."
        value={prefs.weeklyDigest ?? true}
        disabled={!prefs.enabled || update.isPending}
        onChange={(weeklyDigest) => save({ weeklyDigest }, "Настройките са запазени.")}
      />
      </View>
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
        Регионът определя прогнозата за времето.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  codeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  phoneInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: space.xl,
  },
  menu: { borderRadius: radius.lg, backgroundColor: colors.white, overflow: "hidden", paddingBottom: space.sm },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
  },
});
