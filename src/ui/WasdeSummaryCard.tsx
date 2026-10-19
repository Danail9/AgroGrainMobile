import { useState } from "react";
import type { z } from "zod";
import { Pressable, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";

import { wasdeSummarySchema } from "@/api/schemas";
import { formatNumber } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Card } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

type WasdeSummary = z.infer<typeof wasdeSummarySchema>;

export function WasdeSummaryCard({
  summary,
  loading,
  error,
}: {
  summary?: WasdeSummary;
  loading: boolean;
  error: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const openSource = (url: string) => {
    void Linking.openURL(url)
      .then(() => setLinkFailed(false))
      .catch(() => setLinkFailed(true));
  };

  if (loading && !summary) {
    return (
      <Card>
        <AppText variant="small" tone="muted">Зареждаме последния доклад на USDA…</AppText>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card style={{ gap: space.sm, borderColor: colors.amber50, backgroundColor: colors.amber50 }}>
        <AppText variant="body" bold>Докладът WASDE временно не е достъпен</AppText>
        <AppText variant="caption" tone="muted">
          Не успяхме да заредим публикувания XML от USDA. Опитай отново при следващо обновяване.
        </AppText>
        <Pressable
          accessibilityRole="link"
          onPress={() => openSource(
            "https://www.usda.gov/about-usda/general-information/staff-offices/office-chief-economist/commodity-markets/wasde-report",
          )}
        >
          <AppText variant="caption" tone="brand" bold>Страница с докладите на USDA</AppText>
        </Pressable>
        {linkFailed ? (
          <AppText variant="caption" tone="danger">Връзката не се отвори. Провери интернет връзката си и опитай отново.</AppText>
        ) : null}
      </Card>
    );
  }

  const comparison = summary.comparisonMonth
    ? `Спрямо ${summary.comparisonMonth}`
    : "Без предходна месечна оценка";

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="caption" tone="brand" bold>USDA · WASDE</AppText>
          <AppText variant="body" bold>Световен баланс</AppText>
          <AppText variant="caption" tone="muted">
            {summary.reportMonth} · млн. метрични тона
          </AppText>
        </View>
        <View style={styles.globalBadge}>
          <AppText variant="caption" tone="brand" bold>Световни оценки</AppText>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.cropColumn} />
          <AppText variant="caption" tone="muted" style={styles.metricColumn}>
            Производство
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.metricColumn}>
            Крайни запаси
          </AppText>
        </View>
        {summary.estimates.map((estimate) => (
          <View key={`${estimate.commodity}-${estimate.marketYear}`} style={styles.cropRow}>
            <View style={styles.cropColumn}>
              <AppText variant="small" bold numberOfLines={1}>{estimate.commodity}</AppText>
              <AppText variant="caption" tone="muted">{estimate.marketYear}</AppText>
            </View>
            <AppText variant="small" numeric bold style={styles.metricColumn}>
              {estimate.production === null ? "—" : formatNumber(estimate.production, 2)}
            </AppText>
            <AppText variant="small" numeric bold style={styles.metricColumn}>
              {estimate.endingStocks === null ? "—" : formatNumber(estimate.endingStocks, 2)}
            </AppText>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.detailsToggle}
      >
        <AppText variant="caption" tone="brand" bold>
          {expanded ? "Скрий подробностите" : "Подробности и промени"}
        </AppText>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={17} color={colors.brand[700]} />
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <AppText variant="caption" tone="muted" bold>{comparison}</AppText>
          {summary.estimates.map((estimate) => (
            <View key={`${estimate.commodity}-${estimate.marketYear}-details`} style={styles.detailRow}>
              <AppText variant="caption" bold style={{ flex: 1 }}>{estimate.commodity}</AppText>
              <View style={styles.detailValues}>
                <AppText variant="caption" tone="muted">
                  Потребление {estimate.totalUse === null ? "—" : formatNumber(estimate.totalUse, 2)}
                </AppText>
                {estimate.productionChange !== null || estimate.endingStocksChange !== null ? (
                  <AppText variant="caption" tone="muted">
                    Промяна: произв. {formatChange(estimate.productionChange)}, запаси {formatChange(estimate.endingStocksChange)}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="warn">
          Не успяхме да обновим доклада; показваме последното заредено обобщение.
        </AppText>
      ) : null}

      <AppText variant="caption" tone="muted" style={{ lineHeight: 18 }}>
        Световни данни — не са прогноза или цени за България.
      </AppText>

      <Pressable
        accessibilityRole="link"
        onPress={() => openSource(summary.sourceUrl)}
        style={({ pressed }) => [styles.pdfButton, pressed && { opacity: 0.8 }]}
      >
        <Icon name="document-text-outline" size={18} color={colors.white} />
        <AppText variant="small" bold style={{ color: colors.white, flex: 1 }}>
          Пълен доклад (PDF)
        </AppText>
        <Icon name="open-outline" size={17} color={colors.white} />
      </Pressable>
      {linkFailed ? (
        <AppText variant="caption" tone="danger">Връзката не се отвори. Провери интернет връзката си и опитай отново.</AppText>
      ) : null}
    </Card>
  );
}

function formatChange(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value), 2)}`;
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    borderColor: colors.brand[100],
    backgroundColor: colors.brand[50],
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  heading: { flex: 1, gap: 3 },
  globalBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
  },
  table: { gap: 0 },
  tableHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand[200],
  },
  cropColumn: { flex: 1.1, minWidth: 0 },
  metricColumn: { flex: 1, textAlign: "right" },
  cropRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand[100],
  },
  detailsToggle: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  details: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  detailValues: { flex: 1, gap: 2, alignItems: "flex-end" },
  pdfButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.brand[700],
  },
});
