import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useVersion } from "@/api/queries";
import { persistOptions, queryClient, watchConnectivity, watchGates } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { APP_VERSION, STORE_URL, STRIPE_PUBLISHABLE_KEY } from "@/config";
import { isUnsupported } from "@/lib/version";
import { colors } from "@/theme/tokens";
import { DialogHost } from "@/ui/Dialog";
import { Button } from "@/ui/forms";
import { GATE_COPY, Gate } from "@/ui/Gate";

// Keep the splash up until the stored session has been read, so a signed-in
// user never sees a flash of the sign-in screen.
void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { status } = useAuth();
  // Fails open: with no answer (offline, error) the app keeps working.
  const version = useVersion();

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

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

export default function RootLayout() {
  useEffect(() => watchConnectivity(), []);
  useEffect(() => watchGates(), []);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            urlScheme="agrograin"
          >
            <StatusBar style="dark" />
            <Navigator />
            <DialogHost />
          </StripeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
