import { useState } from "react";
import { View } from "react-native";

import { useMarketInsights, useWasdeSummary, useWeeklyMarketReport } from "@/api/queries";
import { space } from "@/theme/tokens";
import { FertilizerIntelligence, useFertilizerIntelligence, type FertilizerFilter } from "@/ui/FertilizerIntelligence";
import { MarketInsightsNews } from "@/ui/MarketInsightsNews";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";
import { WasdeSummaryCard } from "@/ui/WasdeSummaryCard";
import { WeeklyMarketReport } from "@/ui/WeeklyMarketReport";

export default function NewsScreen() {
  const sizov = useMarketInsights("page=1&platform=X&source=sizov&pageSize=2");
  const linville = useMarketInsights("page=1&platform=X&source=linville&pageSize=1");
  const wasde = useWasdeSummary();
  const weekly = useWeeklyMarketReport();
  const [fertilizerFilter, setFertilizerFilter] = useState<FertilizerFilter>("all");
  const fertilizer = useFertilizerIntelligence(fertilizerFilter === "all" ? undefined : fertilizerFilter, 5);

  return (
    <Screen
      tabbed
      back="/"
      title="Агро новини"
      subtitle="Пазарни източници и световни оценки"
      onRefresh={() => void Promise.all([sizov.refetch(), linville.refetch(), wasde.refetch(), weekly.refetch(), fertilizer.refetch()])}
      refreshing={sizov.isRefetching || linville.isRefetching || wasde.isRefetching || weekly.isRefetching || fertilizer.isRefetching}
    >
      <View style={{ gap: space.xl }}>
        <WeeklyMarketReport query={weekly} />
        <MarketInsightsNews sizovQuery={sizov} linvilleQuery={linville} />
        <FertilizerIntelligence query={fertilizer} filter={fertilizerFilter} onFilterChange={setFertilizerFilter} />
        <View style={{ gap: space.sm }}>
          <AppText variant="heading">Световни пазари</AppText>
          <AppText variant="small" tone="muted">Последният публикуван доклад на USDA</AppText>
          <WasdeSummaryCard summary={wasde.data} loading={wasde.isPending} error={wasde.isError} />
        </View>
      </View>
    </Screen>
  );
}
