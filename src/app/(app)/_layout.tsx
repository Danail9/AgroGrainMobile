import { Stack } from "expo-router";
import { View } from "react-native";

import { isApiError } from "@/api/client";
import { useMe } from "@/api/queries";
import { colors, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { GATE_COPY, Gate, SignOutButton } from "@/ui/Gate";
import { ActivityTracker } from "@/ui/ActivityTracker";
import { UpdateBanner } from "@/ui/UpdateBanner";
import { PushRegistrar } from "@/ui/PushRegistrar";
import { ErrorState, Loading } from "@/ui/QueryBoundary";

export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * Decides whether the signed-in user may see the app at all, from the single
 * `/me` bootstrap call. The gates are components standing in for the stack,
 * not routes, so they cannot be navigated around.
 */
export default function AppLayout() {
  const me = useMe();

  if (me.data === undefined) {
    if (me.isPending && me.fetchStatus !== "paused") {
      return (
        <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: "center" }}>
          <Loading />
        </View>
      );
    }

    const offline = me.fetchStatus === "paused" || (isApiError(me.error) && me.error.isConnectivity);
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          justifyContent: "center",
          padding: space.xl,
          gap: space.md,
        }}
      >
        <ErrorState
          icon={offline ? "cloud-offline-outline" : "alert-circle-outline"}
          title={offline ? "Няма връзка" : "Нещо се обърка"}
          message={
            offline
              ? "Свържи се с интернет, за да продължиш."
              : isApiError(me.error)
                ? me.error.message
                : "Възникна грешка. Опитай отново."
          }
          onRetry={() => void me.refetch()}
        />
        <SignOutButton />
      </View>
    );
  }

  const { user, subscription } = me.data;

  if (user.role === "ADMIN") {
    return (
      <Gate
        icon="desktop-outline"
        title={GATE_COPY.admin.title}
        message={GATE_COPY.admin.message}
        actions={<SignOutButton />}
      />
    );
  }

  if (!subscription.active) {
    return (
      <Gate
        icon="lock-closed-outline"
        title={GATE_COPY.inactive.title}
        message={GATE_COPY.inactive.message}
        actions={
          <>
            <Button
              title="Провери отново"
              loading={me.isFetching}
              onPress={() => void me.refetch()}
            />
            <SignOutButton />
          </>
        }
      />
    );
  }

  return (
    <>
      <UpdateBanner />
      <ActivityTracker />
      <PushRegistrar enabled={me.data.notificationPrefs.push} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
