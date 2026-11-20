import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { z } from "zod";

import type { weeklyMarketReportSchema } from "@/api/schemas";
import { colors, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

type Report = z.infer<typeof weeklyMarketReportSchema>;
const sections = [
  ["changes", "Какво се промени", "trending-up-outline"],
  ["grain", "Зърнени пазари", "leaf-outline"],
  ["fertilizers", "Торове", "flask-outline"],
  ["bulgaria", "Възможно отражение за България", "location-outline"],
  ["watchlist", "Какво да следим", "eye-outline"],
] as const;
const unavailable = {
  pending: "Обзорът за изминалата седмица още не е публикуван. Генерира се автоматично при достатъчно публикации и наличен бюджет.",
  failed: "Седмичният обзор не беше генериран успешно. Няма публикуван резултат.",
  withdrawn: "Обзорът е скрит поради промяна в използваните публикации или правата за тях.",
};
const date = (value: string) => value.slice(0, 10).split("-").reverse().join(".");

export function WeeklyMarketReport({ query }: { query: UseQueryResult<Report, Error> }) {
  const [expanded, setExpanded] = useState(false);
  const data = query.data;
  const report = data?.status === "ready" ? data.report : null;
  const failed = query.isError || query.fetchStatus === "paused";
  const toggleLabel = expanded ? "Скрий обзора" : "Прочети обзора";

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.headerIcon}>
          <Icon name="bar-chart-outline" color={colors.brand[700]} size={23} />
        </View>
        <View style={styles.headerText}>
          <AppText variant="caption" tone="brand" bold>AGROGRAIN · AI ОБЗОР</AppText>
          <AppText variant="heading" accessibilityRole="header">Седмичен пазарен обзор</AppText>
          {data && !failed ? <AppText variant="caption" tone="muted">
            {date(data.periodStart)} – {date(data.periodEnd)} · UTC
          </AppText> : null}
        </View>
      </View>
      {failed ? (
        <>
          <AppText variant="small" tone="danger">Не успяхме да заредим седмичния обзор.</AppText>
          <Button title="Обнови обзора" variant="secondary" compact onPress={() => void query.refetch()} />
        </>
      ) : query.isPending ? (
        <AppText variant="small" tone="muted">Зареждаме седмичния обзор…</AppText>
      ) : report ? (
        <>
          {!expanded ? <AppText variant="body" numberOfLines={3} style={styles.pointText}>{report.content.changes[0].text}</AppText> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={toggleLabel}
            accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)}
            style={({ pressed }) => [styles.toggle, pressed && pressedStyle]}>
            <AppText variant="small" tone="brand" bold style={styles.flex}>{toggleLabel}</AppText>
            <Icon name={expanded ? "chevron-up" : "chevron-down"} color={colors.brand[700]} size={17} />
          </Pressable>
          {expanded ? (
            <View style={styles.sections}>
              {sections.map(([key, title, icon]) => (
                <View key={key} style={styles.section}>
                  <View style={styles.row}>
                    <Icon name={icon} color={colors.brand[700]} size={18} />
                    <AppText variant="heading" accessibilityRole="header" style={styles.flex}>{title}</AppText>
                  </View>
                  {report.content[key].length ? report.content[key].map((point, index) => (
                    <View key={index} style={[styles.point, index > 0 && styles.pointDivider]}>
                      <AppText variant="caption" tone={point.kind === "AUTHOR_VIEW" ? "brand" : "warn"} bold>
                        {point.kind === "AUTHOR_VIEW" ? "Според авторите" : "Възможно развитие"}
                      </AppText>
                      <AppText variant="body" style={styles.pointText}>{point.text}</AppText>
                    </View>
                  )) : <AppText variant="small" tone="muted">Недостатъчно данни за периода.</AppText>}
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.note}>
            <Icon name="information-circle-outline" color={colors.muted} size={16} />
            <AppText variant="caption" tone="muted" style={styles.flex}>
              {report.basedOnTranslations ? "На база AI преводи. " : ""}
              Ограничено AI обобщение без независима проверка; не е ценова прогноза.
            </AppText>
          </View>
          {report.sources.some((source) => source.checkOverdue) ? (
            <AppText variant="caption" tone="warn">Наличността на част от източниците в X може да е променена.</AppText>
          ) : null}
        </>
      ) : data && data.status !== "ready" ? (
        <AppText variant="small" tone="muted">{unavailable[data.status]}</AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, borderColor: colors.brand[100] },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  headerIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand[50], alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, gap: space.xs },
  toggle: {
    flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44,
    paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: colors.brand[50],
  },
  sections: { gap: space.md },
  section: { backgroundColor: colors.soft, borderRadius: radius.lg, padding: space.md, gap: space.md },
  point: { gap: space.xs },
  pointDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.md },
  pointText: { lineHeight: 22 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
});
