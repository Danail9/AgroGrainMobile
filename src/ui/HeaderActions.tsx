import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { colors } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { UnreadBadge } from "@/ui/primitives";

function HeaderButton({
  icon,
  label,
  onPress,
  badge = 0,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} нови` : label}
      onPress={onPress}
      hitSlop={8}
      style={{ padding: 6 }}
    >
      <Icon name={badge > 0 ? "notifications" : icon} size={24}
        color={badge > 0 ? colors.amber700 : colors.brand[700]} />
      {badge > 0 ? (
        <View style={{ position: "absolute", top: 0, right: 0 }}>
          <UnreadBadge count={badge} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Shortcuts shown at the right of a tab screen's header. */
export function HeaderActions({
  unreadCount = 0,
  news = false,
}: {
  unreadCount?: number;
  /** Farmers have no news tab, so the home screen offers it here instead. */
  news?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {news ? (
        <HeaderButton icon="newspaper-outline" label="Новини" onPress={() => router.push("/news")} />
      ) : null}
      <HeaderButton
        icon="notifications-outline"
        label="Известия"
        badge={unreadCount}
        onPress={() => router.push("/notifications")}
      />
      <HeaderButton
        icon="person-circle-outline"
        label="Профил"
        onPress={() => router.push("/settings")}
      />
    </View>
  );
}
