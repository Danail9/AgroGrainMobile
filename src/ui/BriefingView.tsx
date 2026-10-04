import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { colors, space } from "@/theme/tokens";
import { BriefingSections, type BriefingSection } from "@/ui/BriefingSections";
import { Icon, type IconName } from "@/ui/Icon";
import { Card, IconTile, pressedStyle, tileColor } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

function NavCard({
  title,
  icon,
  tone,
  href,
}: {
  title: string;
  icon: IconName;
  tone: "brand" | "sky";
  href: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [{ flex: 1 }, pressed && pressedStyle]}
    >
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: 14 }}>
        <IconTile tone={tone} size="sm">
          <Icon name={icon} size={16} color={tileColor(tone)} />
        </IconTile>
        <AppText variant="small" bold style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </AppText>
        <Icon name="chevron-forward" size={16} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

/** The shared layout of the daily and weekly AI briefings. */
export function BriefingView({
  subtitle,
  highlight,
  sections,
}: {
  subtitle: string;
  highlight: string;
  sections: BriefingSection[];
}) {
  return (
    <View style={{ gap: space.lg }}>
      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          backgroundColor: colors.brand[50],
          borderColor: colors.brand[100],
        }}
      >
        <IconTile tone="solid" size="md">
          <Icon name="leaf" size={20} color={colors.white} />
        </IconTile>
        <View style={{ flex: 1 }}>
          <AppText variant="body" bold style={{ color: colors.brand[800] }}>
            AgroGrain AI
          </AppText>
          <AppText variant="caption" bold style={{ color: colors.brand[700] }}>
            {subtitle}
          </AppText>
        </View>
      </Card>

      <BriefingSections sections={sections} />

      {highlight ? (
        <Card
          style={{
            flexDirection: "row",
            gap: space.md,
            backgroundColor: colors.brand[50],
            borderColor: colors.brand[200],
          }}
        >
          <Icon name="chatbox-ellipses" size={18} color={colors.brand[600]} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText
              variant="caption"
              bold
              style={{ color: colors.brand[700], textTransform: "uppercase", letterSpacing: 0.6 }}
            >
              Изводът на AI
            </AppText>
            <AppText variant="small" bold style={{ color: colors.brand[800], lineHeight: 20 }}>
              {highlight}
            </AppText>
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <NavCard title="Пазарен анализ" icon="stats-chart" tone="brand" href="/ai/market" />
        <NavCard title="Анализ на времето" icon="partly-sunny" tone="sky" href="/ai/weather" />
      </View>
    </View>
  );
}
