import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { z } from "zod";

import { useNotifications } from "@/api/queries";
import { notificationsSchema } from "@/api/schemas";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { FormMessage } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

type Notification = z.infer<typeof notificationsSchema>["items"][number];
type BannerPreference = {
  enabled: boolean;
  busy: boolean;
  error: string | null;
  setEnabled: (value: boolean) => Promise<void>;
};
const BannerContext = createContext<BannerPreference | null>(null);

export function InAppNotifications({
  userId, masterEnabled, children,
}: { userId: string; masterEnabled: boolean; children: ReactNode }) {
  const query = useNotifications();
  const insets = useSafeAreaInsets();
  const key = `ag.notification-banners.${userId}`;
  const [enabled, setEnabledState] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Notification | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const writing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(key).then((value) => {
      if (value !== null && value !== "1" && value !== "0") throw new Error("Invalid banner preference");
      if (!cancelled) {
        setEnabledState(value === "1");
        setBusy(false);
      }
    }).catch((cause) => {
      console.error("Reading in-app notification preference failed", cause);
      if (!cancelled) {
        setError("Не успяхме да прочетем настройката за банери. Опитай да я запазиш отново.");
        setBusy(false);
      }
    });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!query.data) return;
    const previous = seen.current;
    seen.current = new Set(query.data.items.map((item) => item.id));
    // The first response is a baseline, not a burst of old alerts.
    if (!previous) return;
    const newest = query.data.items
      .filter((item) => !item.readAt && !previous.has(item.id))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!newest || !enabled || !masterEnabled || AppState.currentState !== "active") return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) setBanner(newest); });
    return () => { cancelled = true; };
  }, [query.data, enabled, masterEnabled]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(timer);
  }, [banner]);

  async function setEnabled(value: boolean) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError(null);
    try {
      await AsyncStorage.setItem(key, value ? "1" : "0");
      setEnabledState(value);
      setBanner(null);
    } catch (cause) {
      console.error("Saving in-app notification preference failed", cause);
      setError("Настройката за банери не е запазена. Опитай отново.");
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return (
    <BannerContext.Provider value={{ enabled, busy, error, setEnabled }}>
      {children}
      {banner && enabled && masterEnabled ? (
        <View style={{
          position: "absolute", top: insets.top + space.sm, left: space.md, right: space.md,
          flexDirection: "row", alignItems: "center", borderRadius: radius.lg,
          backgroundColor: colors.white, borderColor: colors.brand[500], borderWidth: 1,
          ...shadowCard,
        }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ново известие: ${banner.title}`}
            onPress={() => { setBanner(null); router.push("/notifications"); }}
            style={{ flex: 1, flexDirection: "row", padding: space.lg, gap: space.md }}
          >
            <Icon name="notifications" color={colors.brand[600]} size={24} />
            <View style={{ flex: 1, gap: 4 }} accessibilityLiveRegion="polite">
              <AppText variant="small" bold numberOfLines={2}>{banner.title}</AppText>
              <AppText variant="caption" tone="muted" numberOfLines={2}>{banner.body}</AppText>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Затвори известието"
            onPress={() => setBanner(null)} style={{ padding: space.lg }}>
            <Icon name="close" color={colors.muted} size={20} />
          </Pressable>
        </View>
      ) : null}
    </BannerContext.Provider>
  );
}

export function InAppNotificationSettings() {
  const preference = useContext(BannerContext);
  if (!preference) throw new Error("Notification banner settings require InAppNotifications");
  return (
    <View style={{ gap: space.sm, marginBottom: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="small" bold>Банери в приложението</AppText>
          <AppText variant="caption" tone="muted">
            Показва новите известия отгоре, докато използваш приложението. Проверява на всеки 10 секунди.
          </AppText>
        </View>
        <Switch accessibilityLabel="Банери в приложението" value={preference.enabled}
          disabled={preference.busy} onValueChange={(value) => void preference.setEnabled(value)}
          trackColor={{ true: colors.brand[500], false: colors.line }} thumbColor={colors.white} />
      </View>
      <FormMessage error={preference.error} />
    </View>
  );
}
