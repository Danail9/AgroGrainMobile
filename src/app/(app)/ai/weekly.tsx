import { useMe, useWeeklyBriefing } from "@/api/queries";
import { formatShortDate } from "@/lib/format";
import { BriefingView } from "@/ui/BriefingView";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";

export default function WeeklyBriefingScreen() {
  const weekly = useWeeklyBriefing();
  const me = useMe();

  return (
    <Screen
      back="/ai"
      title="Седмичен AI анализ"
      onRefresh={() => void weekly.refetch()}
      refreshing={weekly.isRefetching}
    >
      <QueryBoundary query={weekly}>
        {(data) => (
          <BriefingView
            subtitle={`${formatShortDate(new Date(data.periodStart))} – ${formatShortDate(new Date(data.periodEnd))}${me.data ? ` · ${me.data.user.regionName}` : ""}`}
            highlight={data.highlight}
            sections={data.sections}
          />
        )}
      </QueryBoundary>
    </Screen>
  );
}
