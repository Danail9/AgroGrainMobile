import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/AuthContext";
import { subscriptionLabel } from "@/lib/plans";
import { ROLE_LABELS, initialsOf, notificationSummary } from "@/lib/settings";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { LegalLinks } from "@/ui/LegalLinks";
import { Pill } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import {
  DeleteAccountForm,
  NotificationPrefsForm,
  PasswordForm,
  ProfileForm,
  RegionForm,
} from "@/ui/SettingsForms";
import { SettingsGroup, SettingsRow } from "@/ui/SettingsList";
import { AppText } from "@/ui/Text";

type Section = "profile" | "password" | "region" | "notifications" | "delete";

export default function SettingsScreen() {
  const me = useMe();
  const { signOut } = useAuth();
  // One section open at a time keeps the page short and the open form in focus.
  const [open, setOpen] = useState<Section | null>(null);
  const toggle = (section: Section) => setOpen((current) => (current === section ? null : section));

  function confirmSignOut() {
    showDialog({
      title: "Изход от профила",
      message: "Ще трябва да въведеш имейла и паролата си отново, за да влезеш.",
      icon: "log-out-outline",
      dismissable: true,
      actions: [
        { label: "Отказ", style: "cancel" },
        { label: "Изход", style: "destructive", onPress: () => void signOut() },
      ],
    });
  }

  return (
    <Screen
      back="/"
      title="Профил"
      subtitle="Настройки на акаунта"
      keyboard
      onRefresh={() => void me.refetch()}
      refreshing={me.isRefetching}
    >
      <QueryBoundary query={me} stamp={false}>
        {({ user, subscription, notificationPrefs }) => {
          const phone = user.phone?.trim();
          const place = user.settlement ? `${user.settlement}, ${user.regionName}` : user.regionName;

          return (
            <>
              <View style={styles.hero}>
                <View style={styles.avatar}>
                  <AppText variant="title" style={{ color: colors.brand[700] }}>
                    {initialsOf(user.name)}
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="heading" bold numberOfLines={2}>
                    {user.name}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {user.email}
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    <Pill tone="brand">{ROLE_LABELS[user.role]}</Pill>
                    <Pill tone={subscription.active || subscription.freeAccess || subscription.exempt ? "sky" : "warn"}>
                      {subscriptionLabel(subscription)}
                    </Pill>
                  </View>
                </View>
              </View>

              <SettingsGroup title="Акаунт">
                <SettingsRow
                  first
                  icon="person-outline"
                  title="Лични данни"
                  summary={[user.farmName, phone || "Без телефон"].filter(Boolean).join(" · ")}
                  open={open === "profile"}
                  onPress={() => toggle("profile")}
                >
                  <ProfileForm user={user} />
                </SettingsRow>
                <SettingsRow
                  icon="location-outline"
                  title="Регион"
                  summary={place}
                  open={open === "region"}
                  onPress={() => toggle("region")}
                >
                  <RegionForm user={user} />
                </SettingsRow>
                <SettingsRow
                  icon="lock-closed-outline"
                  title="Парола"
                  summary="Смяна на паролата за вход"
                  open={open === "password"}
                  onPress={() => toggle("password")}
                >
                  <PasswordForm />
                </SettingsRow>
              </SettingsGroup>

              <SettingsGroup title="Абонамент и известия">
                <SettingsRow
                  first
                  icon="card-outline"
                  title="Планове и плащане"
                  summary={subscriptionLabel(subscription)}
                  onPress={() => router.push("/subscription")}
                />
                <SettingsRow
                  icon="notifications-outline"
                  title="Известия"
                  summary={notificationSummary(notificationPrefs, user.role)}
                  open={open === "notifications"}
                  onPress={() => toggle("notifications")}
                >
                  <NotificationPrefsForm prefs={notificationPrefs} role={user.role} />
                </SettingsRow>
              </SettingsGroup>

              <SettingsGroup>
                <SettingsRow first icon="log-out-outline" title="Изход от профила" onPress={confirmSignOut} />
                <SettingsRow
                  danger
                  icon="trash-outline"
                  title="Изтриване на профила"
                  summary="Окончателно изтрива акаунта и данните"
                  open={open === "delete"}
                  onPress={() => toggle("delete")}
                >
                  <DeleteAccountForm />
                </SettingsRow>
              </SettingsGroup>

              <LegalLinks />
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadowCard,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand[100],
    alignItems: "center",
    justifyContent: "center",
  },
});
