import { Linking, Pressable, View } from "react-native";

import { PRIVACY_URL, TERMS_URL } from "@/config";
import { space } from "@/theme/tokens";
import { AppText } from "@/ui/Text";

const LINKS = [
  { label: "Политика за поверителност", url: PRIVACY_URL },
  { label: "Общи условия", url: TERMS_URL },
] as const;

/** Links to the portal's policy pages. */
export function LegalLinks() {
  const links = LINKS.filter((link) => link.url);
  if (!links.length) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, justifyContent: "center" }}>
      {links.map((link) => (
        <Pressable
          key={link.label}
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => void Linking.openURL(link.url!)}
        >
          <AppText variant="caption" tone="brand" bold>
            {link.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
