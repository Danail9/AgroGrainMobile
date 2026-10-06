import { router } from "expo-router";
import { View } from "react-native";

import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/AuthContext";
import { subscriptionLabel } from "@/lib/plans";
import { colors, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Card } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { LegalLinks } from "@/ui/LegalLinks";
import {
  DeleteAccountForm,
  NotificationPrefsForm,
  PasswordForm,
  ProfileForm,
  RegionForm,
} from "@/ui/SettingsForms";
import { AppText } from "@/ui/Text";

export default function SettingsScreen() {
  const me = useMe();
  const { signOut } = useAuth();

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
        {({ user, subscription, notificationPrefs }) => (
          <>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.brand[100],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText variant="heading" style={{ color: colors.brand[700], fontSize: 18 }}>
                  {user.name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="small" bold numberOfLines={1}>
                  {user.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {user.email}
                </AppText>
                {user.farmName ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {user.farmName}
                  </AppText>
                ) : null}
              </View>
            </Card>

            <Card style={{ gap: space.md }}>
              <AppText variant="small" bold>
                Лични данни
              </AppText>
              <ProfileForm user={user} />
            </Card>

            <Card style={{ gap: space.md }}>
              <AppText variant="small" bold>
                Смяна на парола
              </AppText>
              <PasswordForm />
            </Card>

            <Card style={{ gap: 4 }}>
              <AppText variant="small" bold>
                Абонамент
              </AppText>
              <AppText variant="caption" tone="muted">
                {subscriptionLabel(subscription)}
              </AppText>
              <Button
                title="Планове и плащане"
                variant="secondary"
                compact
                onPress={() => router.push("/subscription")}
              />
            </Card>

            <Card style={{ gap: 4 }}>
              <AppText variant="small" bold>
                Известия
              </AppText>
              <NotificationPrefsForm prefs={notificationPrefs} />
            </Card>

            <Card style={{ gap: space.md }}>
              <AppText variant="small" bold>
                Регион
              </AppText>
              <RegionForm user={user} />
            </Card>

            <Button title="Изход от профила" variant="danger" icon="log-out-outline" onPress={() => void signOut()} />

            <Card style={{ gap: space.md }}>
              <AppText variant="small" bold>
                Изтриване на профила
              </AppText>
              <DeleteAccountForm />
            </Card>

            <LegalLinks />
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}
