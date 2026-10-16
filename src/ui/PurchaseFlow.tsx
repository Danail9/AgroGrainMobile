import type { Href } from "expo-router";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatFullDate } from "@/lib/format";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type PurchaseStep = "store" | "verifying" | "activating";

const STEPS: { key: PurchaseStep; label: string; hint: string }[] = [
  { key: "store", label: "Плащане в App Store", hint: "Потвърди покупката в прозореца на Apple" },
  { key: "verifying", label: "Проверка на плащането", hint: "Потвърждаваме транзакцията с Apple" },
  { key: "activating", label: "Активиране на достъпа", hint: "Отключваме всички функции за профила ти" },
];

/** Blocking overlay shown once Apple has charged, while the server confirms and unlocks access. */
export function PurchaseProgress({ step }: { step: PurchaseStep | null }) {
  const visible = step === "verifying" || step === "activating";
  const current = STEPS.findIndex((s) => s.key === step);

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.progressCard} accessibilityRole="progressbar" accessibilityLabel="Обработка на плащането">
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <AppText variant="heading" bold align="center" style={{ marginTop: space.md }}>
            Активираме абонамента
          </AppText>
          <AppText variant="small" tone="muted" align="center" style={{ marginTop: 4 }}>
            Не затваряй приложението. Това отнема няколко секунди.
          </AppText>
          <View style={{ alignSelf: "stretch", gap: space.md, marginTop: space.xl }}>
            {STEPS.map((s, index) => {
              const done = index < current;
              const active = index === current;
              return (
                <View key={s.key} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      done && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
                      active && { borderColor: colors.brand[600] },
                    ]}
                  >
                    {done ? (
                      <Icon name="checkmark" size={14} color={colors.white} />
                    ) : active ? (
                      <ActivityIndicator size="small" color={colors.brand[600]} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="small" bold tone={done || active ? "ink" : "muted"}>
                      {s.label}
                    </AppText>
                    {active ? <AppText variant="caption" tone="muted">{s.hint}</AppText> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type QuickLink = { icon: IconName; title: string; description: string; href: Href };

const FARMER_LINKS: QuickLink[] = [
  { icon: "stats-chart", title: "Пазарни цени", description: "Зърно и торове в реално време", href: "/market" },
  { icon: "partly-sunny", title: "Агро прогноза", description: "14-дневна прогноза за полето", href: "/weather" },
  { icon: "sparkles", title: "AI анализи", description: "Седмични препоръки за пазара", href: "/ai" },
  { icon: "swap-horizontal", title: "AgroGrain Борса", description: "Обяви и контакт с търговци", href: "/trade" },
];

const TRADER_LINKS: QuickLink[] = [
  { icon: "swap-horizontal", title: "AgroGrain Борса", description: "Публикувай и разглеждай оферти", href: "/trade" },
  { icon: "stats-chart", title: "Пазарни цени", description: "Зърно и торове в реално време", href: "/market" },
  { icon: "newspaper", title: "Новини", description: "Пазарни новини и анализи", href: "/news" },
  { icon: "sparkles", title: "AI анализи", description: "Седмични препоръки за пазара", href: "/ai" },
];

export type PurchaseSuccessInfo = {
  kind: "purchase" | "upgrade" | "restore";
  interval: "MONTH" | "YEAR" | null;
  activeUntil: string | null;
  trader: boolean;
};

/** Full-screen confirmation that tells the user what they unlocked and takes them there. */
export function PurchaseSuccess({
  info,
  onNavigate,
}: {
  info: PurchaseSuccessInfo | null;
  onNavigate: (href: Href) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!info) return null;

  const links = info.trader ? TRADER_LINKS : FARMER_LINKS;
  const home: Href = info.trader ? "/trade" : "/";
  const planName = info.interval === "YEAR" ? "Годишен" : info.interval === "MONTH" ? "Месечен" : "Premium";
  const title = info.kind === "restore"
    ? "Покупките са възстановени"
    : info.kind === "upgrade"
      ? "Надградено до годишен план"
      : "Добре дошъл в AgroGrain Premium";
  const subtitle = info.kind === "upgrade"
    ? "Годишният план е потвърден от Apple. Всички функции остават отключени."
    : "Абонаментът ти е активен. Всички функции са отключени.";

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => onNavigate(home)}>
      <View style={[styles.successRoot, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
        <ScrollView contentContainerStyle={{ gap: space.xl, paddingHorizontal: space.xl }}>
          <View style={{ alignItems: "center", gap: space.sm }}>
            <View style={styles.successBadge}>
              <Icon name="checkmark" size={44} color={colors.white} />
            </View>
            <AppText variant="title" align="center" style={{ marginTop: space.md }}>
              {title}
            </AppText>
            <AppText tone="muted" align="center">{subtitle}</AppText>
          </View>

          <View style={styles.summary}>
            <SummaryRow label="План" value={`${planName} абонамент`} />
            {info.activeUntil ? (
              <SummaryRow label="Активен до" value={formatFullDate(new Date(info.activeUntil))} />
            ) : null}
            <SummaryRow label="Плащане" value="Apple ID · автоматично подновяване" />
          </View>

          <View style={{ gap: space.sm }}>
            <AppText variant="heading">Започни оттук</AppText>
            {links.map((link) => (
              <Pressable
                key={link.title}
                accessibilityRole="link"
                onPress={() => onNavigate(link.href)}
                style={({ pressed }) => [styles.linkRow, pressed && pressedStyle]}
              >
                <View style={styles.linkIcon}>
                  <Icon name={link.icon} size={20} color={colors.brand[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="small" bold>{link.title}</AppText>
                  <AppText variant="caption" tone="muted">{link.description}</AppText>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>
          <Button
            title={info.trader ? "Към Борса" : "Към началото"}
            icon="arrow-forward"
            onPress={() => onNavigate(home)}
          />
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="small" tone="muted">{label}</AppText>
      <AppText variant="small" bold style={{ flexShrink: 1, textAlign: "right" }}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 32, 15, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  progressCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: space.xl,
    alignItems: "center",
    ...shadowCard,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  successRoot: { flex: 1, backgroundColor: colors.canvas },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: colors.brand[100],
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
    ...shadowCard,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
});
