import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

// The files sort alphabetically, so without this "forgot-password" would open first.
export const unstable_settings = { initialRouteName: "login" };

export default function AuthGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
  );
}
