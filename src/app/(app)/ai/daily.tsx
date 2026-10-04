import { useDailyBriefing, useMe } from "@/api/queries";
import { AppText } from "@/ui/Text";
import { BriefingView } from "@/ui/BriefingView";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { formatLongDate } from "@/lib/format";

export default function DailyBriefingScreen() {
  const daily = useDailyBriefing();
  const me = useMe();
  const firstName = me.data?.user.name.split(" ")[0];

  return (
    <Screen
      back="/ai"
      title="Какво е важно днес?"
      subtitle={formatLongDate()}
      onRefresh={() => void daily.refetch()}
      refreshing={daily.isRefetching}
    >
      <QueryBoundary query={daily}>
        {(data) => (
          <>
            <BriefingView
              subtitle={`Личен обзор${firstName ? ` за ${firstName}` : ""}${me.data ? ` · ${me.data.user.regionName}` : ""}`}
              highlight={data.highlight}
              sections={data.sections}
            />
            <AppText variant="caption" tone="muted" align="center">
              {data.source === "openai"
                ? "Генерирано от AI по твоите данни за днес."
                : "Съставено по записаните данни за днес."}{" "}
              Не е инвестиционен съвет.
            </AppText>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}
