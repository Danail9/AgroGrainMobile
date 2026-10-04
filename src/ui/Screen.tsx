import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title?: string;
  subtitle?: string;
  /** `true` goes back; an href goes there when there is no history (deep link). */
  back?: boolean | Href;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(typeof back === "boolean" || back === undefined ? "/" : back);
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={goBack}
          hitSlop={10}
          style={styles.back}
        >
          <Icon name="chevron-back" size={24} color={colors.brand[700]} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <AppText variant="title" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  back,
  right,
  children,
  onRefresh,
  refreshing = false,
  tabbed = false,
  keyboard = false,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean | Href;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Inside the tab bar, which already accounts for the bottom inset. */
  tabbed?: boolean;
  keyboard?: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottom = tabbed ? space.xl : insets.bottom + space.xl;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[600]}
            colors={[colors.brand[600]]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1, paddingBottom: bottom }]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle} back={back} right={right} />
      {keyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.canvas,
  },
  back: { marginLeft: -6, padding: 2 },
  content: { padding: space.lg, gap: space.lg },
});
