import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVersion } from "@/api/queries";
import { APP_VERSION, STORE_URL } from "@/config";
import { updateAvailable } from "@/lib/version";
import { colors, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

/** A dismissible hint that a newer build exists; the blocking gate is separate. */
export function UpdateBanner() {
  const version = useVersion();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !version.data || !STORE_URL) return null;
  if (!updateAvailable(APP_VERSION, version.data.latestAppVersion)) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: colors.brand[50],
        paddingTop: insets.top + space.xs,
        paddingBottom: space.xs,
        paddingHorizontal: space.md,
      }}
    >
      <Pressable
        accessibilityRole="link"
        style={{ flex: 1 }}
        onPress={() => void Linking.openURL(STORE_URL!)}
      >
        <AppText variant="caption" bold style={{ color: colors.brand[700] }}>
          Има нова версия на AgroGrain. Натисни, за да обновиш.
        </AppText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Затвори" hitSlop={10} onPress={() => setDismissed(true)}>
        <Icon name="close" size={16} color={colors.brand[700]} />
      </Pressable>
    </View>
  );
}
