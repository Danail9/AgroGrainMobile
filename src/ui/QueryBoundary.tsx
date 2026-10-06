import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { isApiError } from "@/api/client";
import { updatedAgo } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import { Card } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export function Loading() {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Зарежда се">
      <ActivityIndicator size="large" color={colors.brand[600]} />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Опитай отново",
  icon = "alert-circle-outline",
  title = "Нещо се обърка",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: IconName;
  title?: string;
}) {
  return (
    <Card style={{ alignItems: "center", gap: space.md, paddingVertical: space.xl }}>
      <Icon name={icon} size={32} color={colors.muted} />
      <View style={{ gap: 4 }}>
        <AppText variant="heading" align="center">
          {title}
        </AppText>
        <AppText variant="small" tone="muted" align="center">
          {message}
        </AppText>
      </View>
      {onRetry ? <Button title={retryLabel} onPress={onRetry} variant="secondary" compact /> : null}
    </Card>
  );
}

/** A slim notice above cached content: offline, or a refresh that failed. */
export function Notice({ tone, children }: { tone: "warn" | "info"; children: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        { backgroundColor: tone === "warn" ? colors.amber50 : colors.brand[50] },
      ]}
    >
      <AppText
        variant="caption"
        bold
        style={{ color: tone === "warn" ? colors.amber700 : colors.brand[700] }}
      >
        {children}
      </AppText>
    </View>
  );
}

/** Small "обновено преди 2 часа" line shown on every data screen. */
export function Stamp({ timestamp }: { timestamp: number }) {
  if (!timestamp) return null;
  return (
    <AppText variant="caption" tone="muted" align="center">
      {updatedAgo(timestamp)}
    </AppText>
  );
}

function messageOf(error: unknown) {
  return isApiError(error) ? error.message : "Възникна грешка. Опитай отново.";
}

/**
 * One place that decides what a data screen shows.
 *
 * - data present: the screen, with a staleness stamp, and a notice when the
 *   phone is offline or the last refresh failed, so cached content is never
 *   mistaken for live content;
 * - nothing cached and offline: an explicit offline message;
 * - nothing cached and failed: the server's own message with a retry.
 */
export function QueryBoundary<T>({
  query,
  children,
  stamp = true,
}: {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
  stamp?: boolean;
}) {
  if (query.data !== undefined) {
    const offline = query.fetchStatus === "paused";
    return (
      <>
        {offline ? (
          <Notice tone="warn">Няма връзка · показваме последните заредени данни</Notice>
        ) : query.isError ? (
          <Notice tone="warn">Не успяхме да обновим данните · показваме последните заредени</Notice>
        ) : null}
        {children(query.data)}
        {stamp ? <Stamp timestamp={query.dataUpdatedAt} /> : null}
      </>
    );
  }

  if (query.isPending) {
    if (query.fetchStatus === "paused") {
      return (
        <ErrorState
          icon="cloud-offline-outline"
          title="Няма връзка"
          message="Свържи се с интернет, за да заредиш данните."
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <Loading />;
  }

  return <ErrorState message={messageOf(query.error)} onRetry={() => void query.refetch()} />;
}

const styles = StyleSheet.create({
  loading: { paddingVertical: space.xxl * 2, alignItems: "center" },
  notice: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
});
