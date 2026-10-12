import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState, View } from "react-native";


import { isApiError } from "@/api/client";
import { useMe } from "@/api/queries";
import { colors, space } from "@/theme/tokens";
import { GATE_COPY, Gate, SignOutButton } from "@/ui/Gate";
import { ActivityTracker } from "@/ui/ActivityTracker";
import { UpdateBanner } from "@/ui/UpdateBanner";
import { PushRegistrar } from "@/ui/PushRegistrar";
import { Paywall } from "@/ui/Paywall";
import { ErrorState, Loading } from "@/ui/QueryBoundary";
import { InAppNotifications } from "@/ui/InAppNotifications";

export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * Decides whether the signed-in user may see the app at all, from the single
 * `/me` bootstrap call. The gates are components standing in for the stack,
 * not routes, so they cannot be navigated around.
 */
export default function AppLayout() {
  const me = useMe();
  const refetchMe = me.refetch;

  // Coming back from the Stripe checkout in the browser picks up the new plan.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetchMe();
    });
    return () => sub.remove();
  }, [refetchMe]);

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
      <Paywall
        role={user.role}
        checking={me.isFetching}
        onRefresh={() => void me.refetch()}
        actions={<SignOutButton />}
      />
    );
  }

  return (
    <InAppNotifications key={user.id} userId={user.id} masterEnabled={me.data.notificationPrefs.enabled}>
      <UpdateBanner />
      <ActivityTracker />
      <PushRegistrar enabled={me.data.notificationPrefs.push} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </InAppNotifications>
  );
}
