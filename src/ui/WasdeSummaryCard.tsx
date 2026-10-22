import { useState } from "react";
import type { z } from "zod";
import { Pressable, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";

import { wasdeSummarySchema } from "@/api/schemas";
import { formatNumber, monthName } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Card } from "@/ui/primitives";
import { AppText, type Tone } from "@/ui/Text";

type WasdeSummary = z.infer<typeof wasdeSummarySchema>;
type Estimate = WasdeSummary["estimates"][number];
type Region = Estimate["regions"][number];

const SIGNALS = {
  looser: {
    label: "По-свободен баланс",
    description: "Запасите спрямо потреблението се увеличават — предлагането е по-комфортно.",
    tone: "down" as Tone, background: colors.brand[50], border: colors.brand[100],
  },
  tighter: {
    label: "По-стегнат баланс",
    description: "Запасите спрямо потреблението намаляват — предлагането е по-ограничено.",
    tone: "warn" as Tone, background: colors.amber50, border: colors.amber50,
  },
  steady: {
    label: "Без ясна посока",
    description: "Месечната ревизия и сравнението с миналия сезон не сочат в една посока.",
    tone: "muted" as Tone, background: colors.soft, border: colors.line,
  },
} as const;

/** "9 октомври 2026" from an ISO date; built from parts so the day never shifts with the zone. */
export function formatWasdeDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${Number(match[3])} ${monthName(Number(match[2]) - 1)} ${match[1]}`;
}

export function percentChange(current: number | null, previous: number | null | undefined) {
  return current !== null && previous !== null && previous !== undefined && previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;
}

function amount(value: number | null, fractionDigits = 2) {
  return value === null ? "—" : formatNumber(value, fractionDigits);
}

function signed(value: number | null, suffix = "", fractionDigits = suffix === "%" ? 1 : 2) {
  if (value === null) return "—";
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value), fractionDigits)}${suffix}`;
}

export function WasdeSummaryCard({
  summary,
  loading,
  error,
}: {
  summary?: WasdeSummary;
  loading: boolean;
  error: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
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

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="caption" tone="brand" bold>USDA · WASDE</AppText>
          <AppText variant="body" bold>Световен баланс на зърното</AppText>
          <AppText variant="caption" tone="muted">
            Доклад за {summary.reportMonth}
            {summary.releaseDate ? ` · публикуван на ${formatWasdeDate(summary.releaseDate)}` : ""}
          </AppText>
          <AppText variant="caption" tone="muted">Количествата са в млн. метрични тона</AppText>
        </View>
        <View style={styles.globalBadge}>
          <AppText variant="caption" tone="brand" bold>Световни оценки</AppText>
        </View>
      </View>

      {summary.nextReleaseDate ? (
        <View style={styles.nextRelease}>
          <Icon name="calendar-outline" size={16} color={colors.brand[700]} />
          <AppText variant="caption" style={{ flex: 1 }}>
            Следващ доклад: <AppText variant="caption" bold>{formatWasdeDate(summary.nextReleaseDate)}</AppText>
          </AppText>
        </View>
      ) : null}

      <View style={styles.cropList}>
        {summary.estimates.map((estimate) => {
          const key = `${estimate.commodity}-${estimate.marketYear}`;
          return (
            <EstimateBlock
              key={key}
              estimate={estimate}
              comparisonMonth={summary.comparisonMonth}
              expanded={expanded === key}
              onToggle={() => setExpanded((value) => (value === key ? null : key))}
            />
          );
        })}
      </View>

      {error ? (
        <AppText variant="caption" tone="warn">
          Не успяхме да обновим доклада; показваме последното заредено обобщение.
        </AppText>
      ) : null}

      <AppText variant="caption" tone="muted" style={{ lineHeight: 18 }}>
        Световни оценки — не са прогноза за цените в България. „Балансът“ е механично четене на месечната
        ревизия на запасите и на запасите спрямо потреблението в сравнение с миналия сезон.
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

function EstimateBlock({
  estimate,
  comparisonMonth,
  expanded,
  onToggle,
}: {
  estimate: Estimate;
  comparisonMonth: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const signal = estimate.signal ? SIGNALS[estimate.signal] : null;
  const previous = estimate.previousYear;
  const coverDelta = estimate.stocksToUse !== null && previous?.stocksToUse != null
    ? Math.round((estimate.stocksToUse - previous.stocksToUse) * 10) / 10
    : null;

  return (
    <View style={styles.cropCard}>
      <View style={styles.cropHeading}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="small" bold>{estimate.commodity}</AppText>
          <AppText variant="caption" tone="muted">
            Сезон {estimate.marketYear}{previous ? ` · спрямо ${previous.marketYear}` : ""}
          </AppText>
        </View>
        {signal ? (
          <View style={[styles.signal, { backgroundColor: signal.background, borderColor: signal.border }]}>
            <AppText variant="caption" tone={signal.tone} bold>{signal.label}</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.metrics}>
        <Metric label="Производство" value={amount(estimate.production)}
          note={previous ? `${signed(percentChange(estimate.production, previous.production), "%")} г/г` : null} />
        <Metric label="Крайни запаси" value={amount(estimate.endingStocks)}
          note={previous ? `${signed(percentChange(estimate.endingStocks, previous.endingStocks), "%")} г/г` : null} />
        <Metric label="Запаси/потребление"
          value={estimate.stocksToUse === null ? "—" : `${formatNumber(estimate.stocksToUse, 1)}%`}
          note={coverDelta === null ? null : `${signed(coverDelta, "", 1)} п. г/г`} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Скрий" : "Покажи"} подробности за ${estimate.commodity}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.detailsToggle}
      >
        <AppText variant="caption" tone="brand" bold>
          {expanded ? "Скрий подробностите" : "Подробности, региони и ревизии"}
        </AppText>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={17} color={colors.brand[700]} />
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          {signal ? <AppText variant="caption" tone="muted">{signal.description}</AppText> : null}
          <View style={styles.detailsMetrics}>
            <DetailMetric label="Общо потребление" value={amount(estimate.totalUse)} />
            <DetailMetric label={estimate.tradeLabel} value={amount(estimate.trade)} />
            <DetailMetric
              label={`Ревизия на производството${comparisonMonth ? ` спрямо ${comparisonMonth}` : ""}`}
              value={comparisonMonth ? signed(estimate.productionChange) : "—"}
            />
            <DetailMetric
              label={`Ревизия на запасите${comparisonMonth ? ` спрямо ${comparisonMonth}` : ""}`}
              value={comparisonMonth ? signed(estimate.endingStocksChange) : "—"}
            />
          </View>

          {estimate.regions.length ? (
            <View style={{ gap: space.xs }}>
              <AppText variant="caption" bold>Ключови региони за България</AppText>
              {estimate.regions.map((region) => (
                <RegionRow key={region.name} region={region} previousYear={previous?.marketYear ?? null} />
              ))}
            </View>
          ) : null}

          {estimate.context ? (
            <AppText variant="caption" tone="muted" style={{ lineHeight: 18 }}>
              <AppText variant="caption" bold>Защо е важно: </AppText>{estimate.context}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function RegionRow({ region, previousYear }: { region: Region; previousYear: string | null }) {
  const productionYoY = percentChange(region.production, region.previousYearProduction);
  const exportsYoY = percentChange(region.exports, region.previousYearExports);
  return (
    <View style={styles.regionRow}>
      <AppText variant="caption" bold>{region.name}</AppText>
      <View style={styles.regionMetrics}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="muted">Производство</AppText>
          <AppText variant="caption" numeric bold>{amount(region.production)}</AppText>
          <AppText variant="caption" tone="muted">
            {`${signed(productionYoY, "%")} спрямо ${previousYear ?? "миналия сезон"}`}
            {region.productionChange !== null && region.productionChange !== 0 ? ` · ${signed(region.productionChange)} за месеца` : ""}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="muted">Износ</AppText>
          <AppText variant="caption" numeric bold>{amount(region.exports)}</AppText>
          <AppText variant="caption" tone="muted">
            {`${signed(exportsYoY, "%")} спрямо ${previousYear ?? "миналия сезон"}`}
            {region.exportsChange !== null && region.exportsChange !== 0 ? ` · ${signed(region.exportsChange)} за месеца` : ""}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string | null }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      <AppText variant="small" numeric bold>{value}</AppText>
      {note ? <AppText variant="caption" tone="muted">{note}</AppText> : null}
    </View>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailMetric}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      <AppText variant="caption" numeric bold>{value}</AppText>
    </View>
  );
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
  nextRelease: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  cropList: { gap: space.sm },
  cropCard: {
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  cropHeading: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  signal: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  metrics: { flexDirection: "row", gap: space.xs },
  metric: {
    flex: 1,
    gap: 2,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.brand[50],
  },
  detailsToggle: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  details: {
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  detailsMetrics: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  detailMetric: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: 2,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.brand[50],
  },
  regionRow: {
    gap: 4,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.soft,
  },
  regionMetrics: { flexDirection: "row", gap: space.sm },
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
