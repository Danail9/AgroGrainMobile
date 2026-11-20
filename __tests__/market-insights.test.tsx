import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";

import ListScreen from "@/app/(app)/ai/insights/index";
import DetailScreen from "@/app/(app)/ai/insights/[id]";
import TranslatedPostScreen from "@/app/(app)/ai/insights/post/[id]";
import { ApiClientError } from "@/api/client";
import { insightTranslationPreview } from "@/lib/market-insights";

const mockList = jest.fn();
const mockDetail = jest.fn();
const mockTranslate = jest.fn();
let mockTranslationState = { isPending: false, isError: false, error: null as Error | null };
let mockParams: { id?: string; platform?: string } = { id: "insight1" };
jest.mock("expo-router", () => ({
  router: { push: jest.fn() }, useLocalSearchParams: () => mockParams,
}));
jest.mock("@/api/queries", () => ({
  useMarketInsights: (query: string) => mockList(query),
  useMarketInsight: (id: string) => mockDetail(id),
  useRequestMarketInsightTranslation: () => ({ mutate: mockTranslate, ...mockTranslationState }),
}));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/ui/QueryBoundary", () => ({
  QueryBoundary: ({ query, children }: { query: { data?: unknown }; children: (data: unknown) => React.ReactNode }) =>
    query.data ? children(query.data) : null,
  ErrorState: ({ message }: { message: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{message}</Text>;
  },
  Stamp: () => null,
}));

const item = {
  id: "insight1", headline: "Пшеница", summary: "Обобщение", analysis: "Възможно влияние",
  translation: "Превод на публикацията.", crops: ["пшеница"], regions: ["България"], verification: "UNVERIFIED",
  source: { name: "Andrey Sizov", url: "https://x.com/sizov_andre/status/123", publishedAt: "2026-11-14T12:00:00.000Z" },
  evidence: [],
};
const query = { refetch: jest.fn(), isRefetching: false, isError: false, error: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockTranslationState = { isPending: false, isError: false, error: null };
  mockParams = { id: "insight1" };
  mockList.mockReturnValue({ ...query, data: { items: [item], page: 1, hasMore: false } });
  mockDetail.mockReturnValue({ ...query, data: item });
});

it("keeps X-only filtering while navigating the paginated insights feed", async () => {
  mockParams = { platform: "X" };
  mockList.mockReturnValue({ ...query, data: { items: [
    { ...item, id: "other", headline: "Друг източник", source: { ...item.source, url: "https://example.com/post" } },
    item,
  ], page: 1, hasMore: true } });
  await render(<ListScreen />);
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("platform=X");
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("authorMix=balanced");
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("pageSize=20");
  expect(screen.queryByText("Друг източник")).toBeNull();
  expect(screen.getByText("Пшеница")).toBeTruthy();
  await fireEvent.press(screen.getAllByRole("button", { name: "Следваща" })[0]);
  expect(screen.getAllByText("Страница 2")).toHaveLength(2);
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("platform=X");
});

it("opens a source analysis and applies filters", async () => {
  await render(<ListScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Отвори анализ: Пшеница" }));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/ai/insights/[id]", params: { id: "insight1" } });
  expect(screen.queryByLabelText("Култура (точен етикет)")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Филтри" }));
  await fireEvent.press(screen.getByRole("button", { name: "пшеница" }));
  await fireEvent.press(screen.getByRole("button", { name: "Приложи филтрите" }));
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("crop=%D0%BF");
  expect(screen.queryByLabelText("Култура (точен етикет)")).toBeNull();
  expect(screen.getByRole("button", { name: "Филтри (1)" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Изчисти филтрите" }));
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("crop=&");
});

it("links the archive to the notification settings for author opt-ins", async () => {
  await render(<ListScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Известия за автори" }));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/settings", params: { section: "notifications" } });
});

it("lets readers search and select actual crop and author options without typing exact tags", async () => {
  mockParams = { platform: "X" };
  mockList.mockReturnValue({ ...query, data: {
    items: [item], page: 1, hasMore: false,
    filterOptions: { crops: ["пшеница", "царевица", "ечемик", "соя", "рапица", "овес", "ръж", "ориз", "слънчоглед"], regions: ["България"], sources: ["Andrey Sizov", "jlinvillefert"] },
  } });
  await render(<ListScreen />);
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("authorMix=balanced");
  await fireEvent.press(screen.getByRole("button", { name: "Филтри" }));
  expect(screen.queryByLabelText("Култура (точен етикет)")).toBeNull();
  expect(screen.queryByText("Регион")).toBeNull();
  expect(screen.queryByLabelText("Източник")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Търси култура"), "пше");
  expect(screen.queryByRole("button", { name: "царевица" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "пшеница" }));
  expect(screen.getByRole("button", { name: "пшеница" })).toBeSelected();
  await fireEvent.press(screen.getByRole("button", { name: "Josh Linville" }));
  await fireEvent.press(screen.getByRole("button", { name: "Приложи филтрите" }));
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("source=jlinvillefert");
  expect(mockList.mock.calls.at(-1)?.[0]).not.toContain("authorMix");
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("crop=%D0%BF");
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("pageSize=20");
  expect(screen.getByText("пшеница · Josh Linville")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Изчисти филтрите" }));
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("authorMix=balanced");
});

it.each([ListScreen, DetailScreen, TranslatedPostScreen])("shows Josh's display name on post screens", async (Component) => {
  const josh = { ...item, source: { ...item.source, name: "jlinvillefert", url: "https://x.com/jlinvillefert/status/123" } };
  mockList.mockReturnValue({ ...query, data: { items: [josh], page: 1, hasMore: false } });
  mockDetail.mockReturnValue({ ...query, data: josh });
  await render(<Component />);
  expect(screen.getByText("Josh Linville")).toBeTruthy();
  expect(screen.queryByText("jlinvillefert")).toBeNull();
});

it("provides pagination above and below posts with first and last page boundaries", async () => {
  mockList.mockReturnValue({ ...query, data: { items: [item], page: 1, hasMore: true } });
  await render(<ListScreen />);
  expect(screen.getAllByRole("button", { name: "Предишна" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Предишна" })[0]).toBeDisabled();
  await fireEvent.press(screen.getAllByRole("button", { name: "Следваща" })[1]);
  expect(screen.getAllByText("Страница 2")).toHaveLength(2);
  await fireEvent.press(screen.getAllByRole("button", { name: "Предишна" })[0]);
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("page=1");
});

it("resets pagination when filters change and disables controls on the last page", async () => {
  mockList.mockReturnValue({ ...query, data: { items: [item], page: 1, hasMore: true } });
  await render(<ListScreen />);
  await fireEvent.press(screen.getAllByRole("button", { name: "Следваща" })[0]);
  await fireEvent.press(screen.getByRole("button", { name: "Филтри" }));
  await fireEvent.press(screen.getByRole("button", { name: "Andrey Sizov" }));
  mockList.mockReturnValue({ ...query, data: { items: [item], page: 1, hasMore: false } });
  await fireEvent.press(screen.getByRole("button", { name: "Приложи филтрите" }));
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("page=1");
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("source=Andrey+Sizov");
  expect(screen.getAllByRole("button", { name: "Следваща" })[0]).toBeDisabled();
});

it("blocks repeated page requests during fetching and limits archive summaries to three lines", async () => {
  mockList.mockReturnValue({ ...query, isFetching: true, data: { items: [item], page: 1, hasMore: true } });
  await render(<ListScreen />);
  expect(screen.getAllByRole("button", { name: "Следваща" })[0]).toBeDisabled();
  expect(screen.getByText(item.summary).props.numberOfLines).toBe(3);
});

it("shows at most five posts and reaches every post across legacy 20-item API batches", async () => {
  const posts = Array.from({ length: 23 }, (_, index) => ({
    ...item, id: `post-${index}`, headline: `Публикация ${index}`,
  }));
  mockList.mockImplementation((search: string) => {
    const apiPage = Number(new URLSearchParams(search).get("page"));
    return { ...query, data: {
      items: posts.slice((apiPage - 1) * 20, apiPage * 20), page: apiPage, hasMore: apiPage === 1,
    } };
  });
  await render(<ListScreen />);
  const seen: string[] = [];
  for (let page = 1; page <= 5; page++) {
    const cards = screen.getAllByRole("button", { name: /^Отвори анализ:/ });
    expect(cards).toHaveLength(page === 5 ? 3 : 5);
    seen.push(...cards.map((card) => card.props.accessibilityLabel));
    if (page < 5) await fireEvent.press(screen.getAllByRole("button", { name: "Следваща" })[0]);
  }
  expect(new Set(seen).size).toBe(23);
  expect(seen).toEqual(posts.map((post) => `Отвори анализ: ${post.headline}`));
  expect(screen.getAllByRole("button", { name: "Следваща" })[0]).toBeDisabled();
  await fireEvent.press(screen.getAllByRole("button", { name: "Предишна" })[0]);
  expect(screen.getByText("Публикация 15")).toBeTruthy();
  expect(screen.getByText("Публикация 19")).toBeTruthy();
  expect(mockList.mock.calls.at(-1)?.[0]).toContain("page=1&");
});

it("distinguishes the translation, summary, AI interpretation and verified facts", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await render(<DetailScreen />);
  expect(screen.getByText("Интерпретация на AgroGrain AI")).toBeTruthy();
  expect(screen.queryByText("Проверка и източници")).toBeNull();
  expect(screen.queryByText("Няма предоставени проверени факти.")).toBeNull();
  expect(screen.getByText(/Анализът не е напълно проверен/)).toBeTruthy();
  expect(screen.getByText("Превод на публикацията")).toBeTruthy();
  expect(screen.getByText("Превод на публикацията.")).toBeTruthy();
  expect(screen.getByText("Накратко")).toBeTruthy();
  expect(screen.getByText("Обобщение")).toBeTruthy();
  expect(screen.queryByText("Изображение")).toBeNull();
  await fireEvent.press(screen.getByText("Оригинална публикация"));
  expect(open).toHaveBeenCalledWith(item.source.url);
  open.mockRestore();
});

it("shows an authorized chart and explains when its image cannot load", async () => {
  const chartUrl = "https://pbs.twimg.com/media/fertilizer.png";
  mockDetail.mockReturnValue({ ...query, data: {
    ...item, chartUrl, source: { ...item.source, name: "FertilizerWeek", url: "https://x.com/FertilizerWeek1/status/123" },
  } });
  await render(<DetailScreen />);
  const chart = screen.getByLabelText(/Изображение от FertilizerWeek/);
  expect(chart.props.source).toEqual({ uri: chartUrl, cache: "reload" });
  expect(screen.getByText(/евентуалните прогнози са на източника/)).toBeTruthy();
  await fireEvent(chart, "error");
  expect(screen.getByText("Изображението не може да бъде заредено. Виж оригиналната публикация.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Оригинална публикация" })).toBeTruthy();
});

it("hides stale insight content when its refresh fails", async () => {
  mockDetail.mockReturnValue({
    ...query, isError: true, error: new ApiClientError("not_found", "Not found"), data: item,
  });
  await render(<DetailScreen />);
  expect(screen.queryByText("Възможно влияние")).toBeNull();
  expect(screen.getByText("Анализът е премахнат или вече не е публикуван.")).toBeTruthy();
});

it("shows an empty state without inventing reports", async () => {
  mockList.mockReturnValue({ ...query, data: { items: [], page: 1, hasMore: false } });
  await render(<ListScreen />);
  expect(screen.getByText("Няма публикувани анализи за избраните филтри.")).toBeTruthy();
});

it("shows saved-post warnings in the feed, analysis and translated-post screens", async () => {
  const saved = { ...item, source: { ...item.source, checkOverdue: true, lastCheckedAt: null } };
  mockList.mockReturnValue({ ...query, data: { items: [saved], page: 1, hasMore: false } });
  mockDetail.mockReturnValue({ ...query, data: saved });
  const message = "Запазена публикация · няма скорошна проверка за наличност в X.";
  const list = await render(<ListScreen />);
  expect(screen.getByText(message)).toBeTruthy();
  await list.unmount();
  const detail = await render(<DetailScreen />);
  expect(screen.getByText(message)).toBeTruthy();
  await detail.unmount();
  await render(<TranslatedPostScreen />);
  expect(screen.getByText(message)).toBeTruthy();
});

it("shows authorized translation and verified evidence when supplied", async () => {
  mockDetail.mockReturnValue({ ...query, data: {
    ...item, translation: "Текст на превода", verification: "VERIFIED",
    evidence: [{ claim: "Проверен факт", name: "Официален източник", url: "https://example.com/fact", checkedAt: "2026-11-14T12:00:00Z" }],
  } });
  await render(<DetailScreen />);
  expect(screen.getByText("Текст на превода")).toBeTruthy();
  expect(screen.getByText("Проверен факт")).toBeTruthy();
  expect(screen.getByText("Официален източник")).toBeTruthy();
  expect(screen.queryByText("Проверка и източници")).toBeNull();
  expect(screen.getByText(/Анализът е маркиран като проверен/)).toBeTruthy();
  expect(screen.getByText("Превод на публикацията")).toBeTruthy();
  expect(screen.getByText("Накратко")).toBeTruthy();
  expect(screen.getByText("Интерпретация на AgroGrain AI")).toBeTruthy();
});

it("shows only an explicitly labelled excerpt on the analysis screen", async () => {
  const translation = "Първа част на публикацията.\n\n" + "Подробност за пазара. ".repeat(100) + "Край на публикацията.";
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation } });
  await render(<DetailScreen />);
  const text = screen.getByText(insightTranslationPreview(translation).text);
  expect(text.props.numberOfLines).toBeUndefined();
  expect(text.props.selectable).toBe(true);
  expect(screen.queryByText(translation)).toBeNull();
  expect(screen.getByText("Откъс от публикацията · превод с AI")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Виж целия пост" })).toBeTruthy();
});

it("preserves every paragraph and warns when the supplied text ends in an ellipsis", async () => {
  const translation = "Първи абзац.\n\nВтори абзац с 303 300 тона.\n\nТрети абзац…";
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation } });
  await render(<DetailScreen />);
  expect(screen.getByText(translation).props.numberOfLines).toBeUndefined();
  expect(screen.getByText("Преводът завършва с многоточие. Провери оригиналната публикация за пълния текст.")).toBeTruthy();
});

it("opens the translated post in the app", async () => {
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation: "Пълен превод. ".repeat(50) } });
  await render(<DetailScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Виж целия пост" }));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/ai/insights/post/[id]", params: { id: "insight1" } });
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("shows short translations completely without a redundant reader button", async () => {
  await render(<DetailScreen />);
  expect(screen.getByText(item.translation)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Виж целия пост" })).toBeNull();
});

it("shortens only translations over 320 characters and preserves the original", () => {
  expect(insightTranslationPreview("а".repeat(320))).toEqual({ text: "а".repeat(320), shortened: false });
  expect(insightTranslationPreview("а".repeat(321))).toEqual({ text: "а".repeat(319) + "…", shortened: true });
  const original = "Първи абзац.\n\n" + "Думи за пазара. ".repeat(50);
  const preview = insightTranslationPreview(original);
  expect(preview.shortened).toBe(true);
  expect(preview.text.length).toBeLessThanOrEqual(320);
  expect(preview.text.startsWith("Първи абзац.\n\n")).toBe(true);
  expect(original.startsWith(preview.text.slice(0, -1))).toBe(true);
});

it("displays the entire translated post without translation controls", async () => {
  const translation = "Първи абзац.\n\n" + "Пазарни данни. ".repeat(100) + "Последен абзац.";
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation } });
  await render(<TranslatedPostScreen />);
  const text = screen.getByText(translation);
  expect(text.props.numberOfLines).toBeUndefined();
  expect(text.props.selectable).toBe(true);
  expect(screen.queryByText(/Преводът завършва с многоточие/)).toBeNull();
  expect(screen.queryByText("Заяви нов превод")).toBeNull();
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("shows a pending state and prevents duplicate translation requests", async () => {
  mockDetail.mockReturnValue({ ...query, data: { ...item, translationPending: true } });
  await render(<TranslatedPostScreen />);
  expect(screen.queryByText("Преводът се обработва")).toBeNull();
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("shows an unavailable translation and flags a potentially shortened one in the post screen", async () => {
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation: null } });
  await render(<TranslatedPostScreen />);
  expect(screen.getByText("Публикацията не е налична за четене.")).toBeTruthy();
});

it("warns about a trailing ellipsis in the post screen", async () => {
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation: "Съкратен превод..." } });
  await render(<TranslatedPostScreen />);
  expect(screen.getByText("Съкратен превод...")).toBeTruthy();
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("never requests a translation when the screen rerenders", async () => {
  const result = await render(<TranslatedPostScreen />);
  expect(mockTranslate).not.toHaveBeenCalled();
  await result.rerender(<TranslatedPostScreen />);
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("does not request translations after loading fresh data", async () => {
  mockDetail.mockReturnValue({ ...query, isFetching: true, data: item });
  const result = await render(<TranslatedPostScreen />);
  expect(mockTranslate).not.toHaveBeenCalled();
  mockDetail.mockReturnValue({ ...query, isFetching: false, data: item });
  await result.rerender(<TranslatedPostScreen />);
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("replaces the old excerpt with every paragraph from the updated translation", async () => {
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation: "Стар текст..." } });
  const result = await render(<TranslatedPostScreen />);
  mockDetail.mockReturnValue({ ...query, data: { ...item, translationPending: true, translation: "Стар текст..." } });
  await result.rerender(<TranslatedPostScreen />);
  expect(screen.queryByText("Заяви нов превод")).toBeNull();
  const translation = "Царевица за Мексико.\n\nСоя за Китай.\n\nСоя за Виетнам.\n\nСоя за неизвестни дестинации.";
  mockDetail.mockReturnValue({ ...query, data: { ...item, translationPending: false, translation } });
  await result.rerender(<TranslatedPostScreen />);
  expect(screen.getByText(translation).props.numberOfLines).toBeUndefined();
  expect(screen.queryByText("Стар текст...")).toBeNull();
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("surfaces translation request errors without automatically retrying", async () => {
  mockTranslationState = { isPending: false, isError: true, error: new ApiClientError("rate_limited", "Опитай по-късно.") };
  await render(<TranslatedPostScreen />);
  expect(screen.queryByText("Опитай по-късно.")).toBeNull();
  expect(mockTranslate).not.toHaveBeenCalled();
});

it("does not show stale translated content when the post is unavailable", async () => {
  mockDetail.mockReturnValue({ ...query, data: { ...item, translation: "Стар превод" },
    isError: true, error: new ApiClientError("not_found", "Not found") });
  await render(<TranslatedPostScreen />);
  expect(screen.queryByText("Стар превод")).toBeNull();
  expect(screen.getByText("Публикацията не е налична за четене.")).toBeTruthy();
});
