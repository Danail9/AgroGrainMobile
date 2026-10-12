import type { ReactNode } from "react";
import { Modal, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { useBiometricLock } from "@/auth/BiometricContext";
import { colors, radius, space } from "@/theme/tokens";
import { Button, FormMessage } from "@/ui/forms";
import { Gate, SignOutButton } from "@/ui/Gate";
import { AppText } from "@/ui/Text";

export function BiometricOffer() {
  const { status, offerBiometrics, dismissBiometricOffer } = useAuth();
  const lock = useBiometricLock();
  if (
    status !== "signedIn" || !offerBiometrics || !lock.ready || lock.locked ||
    lock.enabled || !lock.capability?.available
  ) return null;

  const label = lock.capability.label;
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => { if (!lock.busy) dismissBiometricOffer(); }}
    >
      <View style={{
        flex: 1, justifyContent: "center", padding: space.xl, backgroundColor: "rgba(0,0,0,0.45)",
      }}>
        <View accessibilityViewIsModal style={{
          padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.white, gap: space.lg,
        }}>
          <AppText variant="heading" bold accessibilityRole="header">
            По-бърз достъп с {label}
          </AppText>
          <AppText tone="muted">
            Профилът ти остава вписан. Следващия път отключи приложението с {label},
            без да въвеждаш имейл и парола.
          </AppText>
          <AppText variant="caption" tone="muted">
            Не съхраняваме паролата ти. При изход или изтекла сесия ще трябва да влезеш
            отново. Можеш да промениш избора от „Профил“.
          </AppText>
          <FormMessage error={lock.error} />
          <Button title={`Включи ${label}`} loading={lock.busy} onPress={() => void lock.setEnabled(true)} />
          <Button title="Не сега" variant="ghost" disabled={lock.busy} onPress={dismissBiometricOffer} />
        </View>
      </View>
    </Modal>
  );
}

export function BiometricBoundary({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const lock = useBiometricLock();
  if (status !== "signedIn" || (lock.ready && !lock.locked)) return children;

  return (
    <Gate
      icon="lock-closed-outline"
      title={lock.ready ? "AgroGrain е заключен" : "Проверка на защитата"}
      message={lock.ready
        ? "Отключи с биометрия или с кода на телефона. Профилът ти остава вписан."
        : "Проверяваме настройките за сигурен достъп."}
      actions={
        <>
          <FormMessage error={lock.error} />
          {lock.ready ? (
            <Button
              title={`Отключи с ${lock.capability?.label ?? "биометрия"}`}
              onPress={() => void lock.unlock()}
              loading={lock.busy}
            />
          ) : lock.error ? (
            <Button title="Опитай отново" onPress={() => void lock.reload()} />
          ) : null}
          <SignOutButton />
        </>
      }
    />
  );
}

export function BiometricSettings() {
  const lock = useBiometricLock();
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="small" tone="muted">
        Заключва приложението, когато го оставиш на заден план. Отключването използва
        биометрията или кода на телефона, без да съхранява паролата ти.
      </AppText>
      <FormMessage error={lock.error} />
      {!lock.enabled && lock.capability?.reason ? (
        <AppText variant="small" tone="muted">{lock.capability.reason}</AppText>
      ) : null}
      {!lock.capability && lock.error ? (
        <Button title="Провери отново" variant="secondary" onPress={() => void lock.reload()} />
      ) : null}
      <Button
        title={lock.enabled ? "Изключи заключването" : `Включи ${lock.capability?.label ?? "биометрия"}`}
        loading={lock.busy}
        disabled={!lock.ready || (!lock.enabled && !lock.capability?.available)}
        onPress={() => void lock.setEnabled(!lock.enabled)}
      />
    </View>
  );
}
