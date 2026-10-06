import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthContext";
import { colors, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import { Logo } from "@/ui/AuthLayout";
import { AppText } from "@/ui/Text";

/**
 * The wording of the gates. One definition, used by the screens and asserted
 * on in the tests, so the no-price rule cannot be broken by editing one copy.
 */
export const GATE_COPY = {
  inactive: {
    title: "Абонаментът ти е неактивен",
    message:
      "Достъпът до AgroGrain изисква активен абонамент. Когато абонаментът ти бъде активиран, натисни „Провери отново“.",
  },
  admin: {
    title: "Администраторски профил",
    message: "Администраторският панел е достъпен само в уеб портала на AgroGrain.",
  },
  update: {
    title: "Нужна е нова версия",
    message: "Тази версия на приложението вече не се поддържа. Обнови го, за да продължиш.",
  },
  noTrade: {
    title: "Борсата не е включена",
    message: "Този раздел не е включен в плана ти.",
  },
} as const;

/**
 * A full-screen notice that stands in for the app: an inactive plan, a plan
 * tier without the exchange, an admin account.
 *
 * Note: the inactive gate is replaced by the paywall (Paywall.tsx); the rest only say what is wrong. They show no price,
 * no plan comparison, no purchase button and no link to buy anything. Apple
 * (guideline 3.1.1) and Google Play reject apps that sell digital access
 * outside their own billing, so softening this copy later risks the listing.
 */
export function Gate({
  icon,
  title,
  message,
  actions,
}: {
  icon: IconName;
  title: string;
  message: string;
  actions?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top + space.xxl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.xl,
        gap: space.xl,
      }}
    >
      <Logo />
      <View style={{ gap: space.md }}>
        <Icon name={icon} size={34} color={colors.brand[600]} />
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        <AppText tone="muted" style={{ lineHeight: 22 }}>
          {message}
        </AppText>
      </View>
      <View style={{ gap: space.sm }}>{actions}</View>
    </View>
  );
}

export function SignOutButton() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      title="Изход"
      variant="secondary"
      loading={busy}
      onPress={() => {
        setBusy(true);
        void signOut();
      }}
    />
  );
}
