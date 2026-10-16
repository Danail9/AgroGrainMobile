import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { Linking, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useVersion } from "@/api/queries";
import { persistOptions, queryClient, watchConnectivity, watchGates, watchNotificationFreshness } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { BiometricProvider } from "@/auth/BiometricContext";
import { APP_VERSION, STORE_URL, STRIPE_PUBLISHABLE_KEY } from "@/config";
import { wrapRoot } from "@/lib/monitoring";
import { isUnsupported } from "@/lib/version";
import { colors } from "@/theme/tokens";
import { DialogHost } from "@/ui/Dialog";
import { BiometricBoundary, BiometricOffer } from "@/ui/BiometricLock";
import { Button } from "@/ui/forms";
import { GATE_COPY, Gate } from "@/ui/Gate";
import { AppOpenTracker } from "@/ui/AppOpenTracker";

// Keep the splash up until the stored session has been read, so a signed-in
// user never sees a flash of the sign-in screen.
void SplashScreen.preventAutoHideAsync();

function SessionSplash() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);
  return null;
}

function BiometricSession({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  return (
    <BiometricProvider key={status}>
      <BiometricBoundary>{children}</BiometricBoundary>
    </BiometricProvider>
  );
}

function Navigator() {
  const { status } = useAuth();
  useEffect(() => {
    if (status === "signedIn") return watchNotificationFreshness();
  }, [status]);
  // Fails open: with no answer (offline, error) the app keeps working.
  const version = useVersion();

  if (status === "loading") return null;

  if (version.data && isUnsupported(APP_VERSION, version.data.minSupportedAppVersion)) {
    return (
      <Gate
        icon="cloud-download-outline"
        title={GATE_COPY.update.title}
        message={GATE_COPY.update.message}
        actions={
          STORE_URL ? <Button title="Обнови" onPress={() => void Linking.openURL(STORE_URL!)} /> : undefined
        }
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  useEffect(() => watchConnectivity(), []);
  useEffect(() => watchGates(), []);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <BillingProvider>
            <StatusBar style="dark" />
            <SessionSplash />
            <AppOpenTracker />
            <BiometricSession>
              <Navigator />
              <DialogHost />
              <BiometricOffer />
            </BiometricSession>
          </BillingProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);

function BillingProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === "ios") return children;
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="agrograin">
      <>{children}</>
    </StripeProvider>
  );
}
