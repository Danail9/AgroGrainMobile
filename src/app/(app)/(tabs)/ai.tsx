import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMe, useWeather } from "@/api/queries";
import { SUGGESTIONS } from "@/lib/ai";
import { updatedAgo } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { Card, IconTile, pressedStyle } from "@/ui/primitives";
import { QueryBoundary, Notice } from "@/ui/QueryBoundary";
import { Button } from "@/ui/forms";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

const TOOLS: { href: Href; label: string; description: string; icon: IconName }[] = [
  { href: "/ai/daily", label: "Дневен обзор", description: "Най-важното за днес", icon: "sparkles-outline" },
  { href: "/ai/weather", label: "Анализ на времето", description: "Условия за полска работа", icon: "partly-sunny-outline" },
  { href: "/ai/market", label: "Пазарен обзор", description: "Цени и тенденции", icon: "stats-chart-outline" },
  { href: "/ai/calculator", label: "Калкулатори", description: "Семена, торове и добив", icon: "calculator-outline" },
];

export default function AiScreen() {
  const me = useMe();
  const weather = useWeather();
  const [moreQuestions, setMoreQuestions] = useState(false);
  return <Screen tabbed title="AgroGrain AI" subtitle="Твоят земеделски асистент">
    <QueryBoundary query={me} stamp={false}>{({ user }) => <View style={{ gap: space.xs }}>
      <AppText variant="small" bold>Регион от профила: {user.regionName}</AppText>
      <AppText variant="caption" tone="muted">Временният избор във Време не променя контекста на AI.</AppText>
    </View>}</QueryBoundary>
    <Card style={{ backgroundColor: colors.brand[50], gap: space.md }}>
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <IconTile tone="solid" size="md"><Icon name="chatbubble-ellipses-outline" color={colors.white} /></IconTile>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Попитай AgroGrain AI</AppText>
          <AppText variant="small" tone="muted">За времето, пазара и земеделската работа</AppText>
        </View>
      </View>
      <Button title="Започни разговор" icon="arrow-forward-outline" onPress={() => router.push("/ai/chat")} />
    </Card>
    <View style={{ gap: space.sm }}>
      {[TOOLS.slice(0, 2), TOOLS.slice(2)].map((row, index) => <View key={index}
        testID={`ai-tool-row-${index}`} style={{ flexDirection: "row", alignItems: "stretch", gap: space.sm }}>
      {row.map((tool) => <Pressable key={tool.href.toString()} accessibilityRole="button" accessibilityLabel={tool.label}
        onPress={() => router.push(tool.href)} style={({ pressed }) => [{ flex: 1 }, pressed && pressedStyle]}>
        <Card style={{ flex: 1, minHeight: 124, gap: space.sm }}>
          <Icon name={tool.icon} size={24} color={colors.brand[600]} />
          <AppText variant="small" bold>{tool.label}</AppText>
          <AppText variant="caption" tone="muted">{tool.description}</AppText>
        </Card>
      </Pressable>)}
      </View>)}
    </View>
    <QueryBoundary query={weather} stamp={false}>{(data) => <Card style={{ gap: space.sm }}>
      <AppText bold>Условия днес · {data.weather.regionName}</AppText>
      <AppText variant="caption" tone="muted">{updatedAgo(weather.dataUpdatedAt)} · последно получаване на данните</AppText>
      {data.weather.isFallback ? <Notice tone="warn">Демо данни — не използвай за планиране на пръскане или полска работа.</Notice> :
        <AppText variant="small">{data.fieldWork[0]?.reason || data.weather.current.condition.label}</AppText>}
      <Button title="Отвори анализа на времето" compact variant="secondary" onPress={() => router.push("/ai/weather")} />
    </Card>}</QueryBoundary>
    <Button title="Съвети за седмицата" compact variant="secondary" icon="calendar-outline" onPress={() => router.push("/ai/weekly")} />
    <View style={{ gap: space.sm }}>
      <AppText variant="heading">Примерни въпроси</AppText>
      {(moreQuestions ? SUGGESTIONS : SUGGESTIONS.slice(0, 3)).map((question) => <Button key={question} title={question}
        variant="secondary" onPress={() => router.push({ pathname: "/ai/chat", params: { q: question } })} />)}
      <Button title={moreQuestions ? "По-малко въпроси" : "Още въпроси"} compact variant="ghost" onPress={() => setMoreQuestions((value) => !value)} />
    </View>
    <AppText variant="caption" tone="muted">AI може да греши. Прогнозата не е разрешение за пръскане, а пазарният обзор не гарантира бъдещи цени.</AppText>
  </Screen>;
}
