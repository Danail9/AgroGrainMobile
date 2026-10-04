import { Tabs } from "expo-router/js-tabs";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/api/queries";
import { colors } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";

type TabDef = { name: string; title: string; icon: IconName; iconActive: IconName };

const TAB: Record<string, TabDef> = {
  index: { name: "index", title: "Начало", icon: "home-outline", iconActive: "home" },
  dashboard: { name: "index", title: "Табло", icon: "grid-outline", iconActive: "grid" },
  weather: { name: "weather", title: "Време", icon: "partly-sunny-outline", iconActive: "partly-sunny" },
  market: { name: "market", title: "Пазар", icon: "stats-chart-outline", iconActive: "stats-chart" },
  trade: { name: "trade", title: "Борса", icon: "swap-horizontal-outline", iconActive: "swap-horizontal" },
  news: { name: "news", title: "Новини", icon: "newspaper-outline", iconActive: "newspaper" },
  ai: { name: "ai", title: "AI", icon: "sparkles-outline", iconActive: "sparkles" },
};

/**
 * The portal's phone bar is six items; a phone fits five. Farmers lose the
 * news tab and traders lose the weather tab (as in the portal's `TRADER_NAV`),
 * but both screens stay routable, so any link to them still works.
 */
const FARMER_TABS = [TAB.index, TAB.weather, TAB.market, TAB.trade, TAB.ai];
const TRADER_TABS = [TAB.dashboard, TAB.trade, TAB.market, TAB.news, TAB.ai];
const ALL = ["index", "weather", "market", "trade", "news", "ai"];

export default function TabsLayout() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const trader = me.data?.user.role === "TRADER";
  const visible = trader ? TRADER_TABS : FARMER_TABS;
  const shown = new Set(visible.map((tab) => tab.name));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? insets.bottom : Math.max(insets.bottom, 6),
        },
      }}
    >
      {visible.map((tab) => (
        <Tabs.Screen
          key={`${tab.name}-${tab.title}`}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Icon name={focused ? tab.iconActive : tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
      {ALL.filter((name) => !shown.has(name)).map((name) => (
        <Tabs.Screen key={`hidden-${name}`} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
