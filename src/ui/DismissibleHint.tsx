import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { colors, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { Card } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

const PREFIX = "hint-dismissed:";

/**
 * A one-time explanation the user can close for good. Hidden until storage
 * answers, so a dismissed hint never flashes on screen.
 */
export function DismissibleHint({ id, icon, children }: { id: string; icon: IconName; children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PREFIX + id)
      .then((value) => alive && setVisible(value !== "1"))
      .catch(() => alive && setVisible(true));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!visible) return null;

  return (
    <Card
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: colors.brand[50],
        borderColor: colors.brand[100],
      }}
    >
      <Icon name={icon} size={22} color={colors.brand[600]} />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" tone="muted">
          {children}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Скрий подсказката"
        hitSlop={10}
        onPress={() => {
          setVisible(false);
          void AsyncStorage.setItem(PREFIX + id, "1");
        }}
      >
        <Icon name="close" size={18} color={colors.muted} />
      </Pressable>
    </Card>
  );
}
