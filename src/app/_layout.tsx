import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { persistOptions, queryClient, watchConnectivity, watchGates } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme/tokens";

// Keep the splash up until the stored session has been read, so a signed-in
// user never sees a flash of the sign-in screen.
void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null;

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
          <StatusBar style="dark" />
          <Navigator />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
