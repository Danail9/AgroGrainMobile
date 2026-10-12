import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  useClearNotifications,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from "@/api/queries";
import { relativeTime } from "@/lib/format";
import { NOTIFICATION_ICONS, internalPath } from "@/lib/notifications";
import { colors, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { Card, Divider, IconTile, RowList, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function NotificationsScreen() {
  const query = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const clear = useClearNotifications();

  return (
    <Screen
      back="/"
      title="Известия"
      subtitle="Аларми за цени и време във твоя регион"
      onRefresh={() => {
        setRefreshing(true);
        void query.refetch().finally(() => setRefreshing(false));
      }}
      refreshing={refreshing}
    >
      <QueryBoundary query={query}>
        {({ items, unreadCount }) => (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText variant="caption" tone="muted" bold>
                {unreadCount > 0
                  ? `${unreadCount} непрочетени`
                  : items.length > 0
                    ? "Всичко е прочетено"
                    : "Няма нови аларми"}
              </AppText>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {unreadCount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => markAll.mutate()}
                    hitSlop={8}
                    style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                  >
                    <AppText variant="caption" tone="brand" bold>
                      Прочети всички
                    </AppText>
                  </Pressable>
                ) : null}
                {items.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      showDialog({
                        title: "Да изтрия ли всички известия?",
                        message: "Това действие не може да бъде отменено.",
                        icon: "trash-outline",
                        tone: "danger",
                        dismissable: true,
                        actions: [
                          { label: "Отказ", style: "cancel" },
                          { label: "Изтрий", style: "destructive", onPress: () => clear.mutate() },
                        ],
                      })
                    }
                    hitSlop={8}
                    style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                  >
                    <AppText variant="caption" tone="danger" bold>
                      Изтрий
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {items.length === 0 ? (
              <Card style={{ alignItems: "center", gap: space.md, paddingVertical: space.xxl }}>
                <IconTile tone="neutral" size="lg">
                  <Icon name="notifications-off-outline" size={22} color={colors.ink} />
                </IconTile>
                <View style={{ gap: 4 }}>
                  <AppText variant="small" bold align="center">
                    Няма известия
                  </AppText>
                  <AppText variant="caption" tone="muted" align="center">
                    Ще те уведомим при резки промени в цените или времето във твоя регион.
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/settings")}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.soft,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    },
                    pressed && pressedStyle,
                  ]}
                >
                  <AppText variant="caption" bold>
                    Настрой алармите
                  </AppText>
                </Pressable>
              </Card>
            ) : (
              <RowList>
                {items.map((item, index) => {
                  const unread = !item.readAt;
                  const target = internalPath(item.url);
                  return (
                    <View key={item.id}>
                      {index > 0 ? <Divider /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${unread ? "Непрочетено. " : ""}${item.title}`}
                        onPress={() => {
                          if (unread) markRead.mutate(item.id, {
                            onError: (error) => showDialog({
                              title: "Известието не е отбелязано като прочетено",
                              message: error.message,
                              tone: "danger",
                              icon: "alert-circle-outline",
                            }),
                          });
                          if (target) router.push(target);
                        }}
                        style={({ pressed }) => [
                          {
                            flexDirection: "row",
                            gap: space.md,
                            padding: space.lg,
                            backgroundColor: unread ? colors.brand[50] : colors.white,
                          },
                          pressed && pressedStyle,
                        ]}
                      >
                        <IconTile tone={unread ? "solid" : "neutral"} size="md">
                          <Icon
                            name={NOTIFICATION_ICONS[item.type]}
                            size={18}
                            color={unread ? colors.white : colors.muted}
                          />
                        </IconTile>
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="small" tone={unread ? "ink" : "muted"} bold>
                            {item.title}
                          </AppText>
                          <AppText variant="small" tone="muted" style={{ lineHeight: 20 }}>
                            {item.body}
                          </AppText>
                          <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
                            {relativeTime(new Date(item.createdAt))}
                          </AppText>
                        </View>
                        {target ? <Icon name="chevron-forward" size={16} color={colors.muted} /> : null}
                      </Pressable>
                    </View>
                  );
                })}
              </RowList>
            )}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}
