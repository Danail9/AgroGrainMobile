import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

export type AccountRole = "FARMER" | "TRADER";

export const ACCOUNT_TYPES: {
  value: AccountRole;
  label: string;
  hint: string;
  icon: IconName;
  nameLabel: string;
  namePlaceholder: string;
}[] = [
  {
    value: "FARMER",
    label: "Фермер",
    hint: "Продавам продукция",
    icon: "leaf",
    nameLabel: "Стопанство",
    namePlaceholder: "ЗП Добруджа",
  },
  {
    value: "TRADER",
    label: "Търговец",
    hint: "Купувам и публикувам цени",
    icon: "swap-horizontal",
    nameLabel: "Фирма",
    namePlaceholder: "АгроТрейд ЕООД",
  },
];

export function accountType(role: AccountRole) {
  return ACCOUNT_TYPES.find((type) => type.value === role) ?? ACCOUNT_TYPES[0];
}

/** Farmer/trader choice shown on registration and after Google/Apple sign-in. */
export function AccountTypePicker({
  value,
  onChange,
}: {
  value: AccountRole;
  onChange: (role: AccountRole) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" tone="muted" bold>
        Тип профил
      </AppText>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {ACCOUNT_TYPES.map((type) => {
          const selected = type.value === value;
          return (
            <Pressable
              key={type.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(type.value)}
              style={[styles.typeCard, selected && styles.typeCardSelected]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name={type.icon} size={16} color={colors.brand[700]} />
                <AppText variant="small" bold>
                  {type.label}
                </AppText>
              </View>
              <AppText variant="caption" tone="muted">
                {type.hint}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  typeCard: {
    flex: 1,
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeCardSelected: { borderColor: colors.brand[600], backgroundColor: colors.brand[50] },
});
