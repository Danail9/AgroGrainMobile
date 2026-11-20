import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import NewsScreen from "@/app/(app)/(tabs)/news";

const mockInsights = jest.fn();
const mockRefetch = jest.fn();
const mockWasdeRefetch = jest.fn();
const mockNews = jest.fn();
const mockWeekly = jest.fn();
const mockWeeklyRefetch = jest.fn();
let refreshScreen: (() => void) | undefined;
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/api/queries", () => ({
  useNews: () => mockNews(),
  useWasdeSummary: () => ({ isPending: false, isError: false, isRefetching: false, refetch: mockWasdeRefetch }),
  useMarketInsights: (query: string) => mockInsights(query),
  useWeeklyMarketReport: () => mockWeekly(),
}));
jest.mock("@/ui/Screen", () => ({
  Screen: ({ children, onRefresh }: { children: React.ReactNode; onRefresh: () => void }) => {
    refreshScreen = onRefresh;
    return children;
  },
}));
jest.mock("@/ui/WasdeSummaryCard", () => {
  const { Text } = jest.requireActual("react-native");
  return { WasdeSummaryCard: () => <Text>USDA report</Text> };
});

const item = {
  id: "insight1", headline: "Пазар на пшеница", summary: "Пазарно обобщение", analysis: "Анализ",
  translation: "Пълен превод.", crops: ["пшеница"], regions: [], verification: "UNVERIFIED",
  source: { name: "Andrey Sizov", url: "https://x.com/sizov_andre/status/123", publishedAt: "2026-11-14T12:00:00.000Z" },
  evidence: [],
};
const query = { refetch: mockRefetch, isRefetching: false, isPending: false, isError: false, fetchStatus: "idle" };
const weekly = {
  status: "ready", periodStart: "2026-11-09T00:00:00Z", periodEnd: "2026-11-15T23:59:59.999Z",
  report: {
    id: "weekly1", generatedAt: "2026-11-16T12:00:00Z",
    content: {
      changes: [{ text: "Авторът описва несигурност в предлагането на зърно.", kind: "AUTHOR_VIEW", sourceIds: ["a"] }],
      grain: [], fertilizers: [], bulgaria: [], watchlist: [],
    },
    sources: [
      { id: "a", insightId: "insight1", name: "Andrey Sizov", username: "sizov_andre",
        url: "https://x.com/sizov_andre/status/123", publishedAt: "2026-11-12T12:00:00Z",
        lastCheckedAt: null, checkOverdue: true },
      { id: "b", insightId: "insight2", name: "Josh Linville", username: "jlinvillefert",
        url: "https://x.com/jlinvillefert/status/124", publishedAt: "2026-11-13T12:00:00Z",
        lastCheckedAt: null, checkOverdue: true },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInsights.mockReturnValue({ ...query, data: { items: [item], page: 1, hasMore: false } });
  mockWeekly.mockReturnValue({
    ...query, refetch: mockWeeklyRefetch,
    data: { status: "pending", periodStart: weekly.periodStart, periodEnd: weekly.periodEnd, report: null },
  });
});

it("expands and collapses the report without showing its source list, citations or post count", async () => {
  mockWeekly.mockReturnValue({ ...query, data: weekly, refetch: mockWeeklyRefetch });
  const result = await render(<NewsScreen />);
  expect(screen.getByText("09.11.2026 – 15.11.2026 · UTC")).toBeTruthy();
  const tree = JSON.stringify(result.toJSON());
  expect(tree.indexOf("Седмичен пазарен обзор")).toBeLessThan(tree.indexOf("Пазарен поглед"));
  await fireEvent.press(screen.getByRole("button", { name: "Прочети обзора" }));
  expect(screen.getByText("Торове")).toBeTruthy();
  expect(screen.getByText("Възможно отражение за България")).toBeTruthy();
  expect(screen.getByText("Какво да следим")).toBeTruthy();
  expect(screen.getAllByText("Недостатъчно данни за периода.")).toHaveLength(4);
  expect(screen.getByText(/не е ценова прогноза/)).toBeTruthy();
  expect(screen.getByText(/Наличността на част от източниците/)).toBeTruthy();
  expect(screen.queryByText("Използвани публикации")).toBeNull();
  expect(screen.queryByText(/Източници:/)).toBeNull();
  expect(screen.queryByText(/2 публикации/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Източник \d/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Скрий обзора", expanded: true }));
  expect(screen.queryByText("Торове")).toBeNull();
  expect(screen.getByRole("button", { name: "Прочети обзора", expanded: false })).toBeTruthy();
});

it("hides stale weekly content on a network failure and offers a read-only refresh", async () => {
  mockWeekly.mockReturnValue({ ...query, data: weekly, isError: true, refetch: mockWeeklyRefetch });
  await render(<NewsScreen />);
  expect(screen.queryByText(weekly.report.content.changes[0].text)).toBeNull();
  expect(screen.getByText("Не успяхме да заредим седмичния обзор.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Обнови обзора" }));
  expect(mockWeeklyRefetch).toHaveBeenCalledTimes(1);
});

it("labels a weekly report based on saved AI translations", async () => {
  mockWeekly.mockReturnValue({
    ...query, refetch: mockWeeklyRefetch,
    data: { ...weekly, report: { ...weekly.report, basedOnTranslations: true } },
  });
  await render(<NewsScreen />);
  expect(screen.getByText(/На база AI преводи/)).toBeTruthy();
});

it.each(["failed", "withdrawn"])("does not display report content when its state is %s", async (status) => {
  mockWeekly.mockReturnValue({
    ...query, data: { ...weekly, status, report: null }, refetch: mockWeeklyRefetch,
  });
  await render(<NewsScreen />);
  expect(screen.queryByText("Прочети обзора")).toBeNull();
  expect(screen.queryByText(weekly.report.content.changes[0].text)).toBeNull();
  expect(screen.getByText(status === "failed"
    ? "Седмичният обзор не беше генериран успешно. Няма публикуван резултат."
    : "Обзорът е скрит поради промяна в използваните публикации или правата за тях.")).toBeTruthy();
});

it("shows X insights above USDA without requesting ordinary news", async () => {
  await render(<NewsScreen />);
  expect(mockInsights).toHaveBeenCalledWith("page=1&platform=X&source=sizov&pageSize=2");
  expect(mockInsights).toHaveBeenCalledWith("page=1&platform=X&source=linville&pageSize=1");
  expect(mockNews).not.toHaveBeenCalled();
  expect(screen.getByText("Пазарно обобщение")).toBeTruthy();
  expect(screen.getByText("USDA report")).toBeTruthy();
  expect(screen.getByText("AI обобщение · твърденията не са напълно проверени")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Пазарен анализ: Пазар на пшеница" }));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/ai/insights/[id]", params: { id: "insight1" } });
  await fireEvent.press(screen.getByText("Виж още пазарни новини"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/ai/insights", params: { platform: "X" } });
});

it("reserves two preview cards for Andrey and one for Josh even when Josh's post is older", async () => {
  const sizov = Array.from({ length: 5 }, (_, index) => ({
    ...item, id: `sizov${index}`, headline: `Andrey post ${index}`,
  }));
  const linville = Array.from({ length: 3 }, (_, index) => ({
    ...item, id: `josh${index}`, headline: `Josh post ${index}`,
    source: {
      ...item.source, name: "jlinvillefert", url: `https://x.com/jlinvillefert/status/${index + 1}`,
      publishedAt: "2026-11-01T12:00:00Z",
    },
  }));
  mockInsights.mockImplementation((params: string) => ({
    ...query, data: { items: params.includes("source=linville") ? linville : sizov, page: 1, hasMore: true },
  }));
  await render(<NewsScreen />);
  expect(screen.getByText("Andrey Sizov · Josh Linville")).toBeTruthy();
  expect(screen.getByText("Andrey post 0")).toBeTruthy();
  expect(screen.getByText("Andrey post 1")).toBeTruthy();
  expect(screen.getByText("Josh post 0")).toBeTruthy();
  expect(screen.queryByText("Andrey post 2")).toBeNull();
  expect(screen.queryByText("Josh post 1")).toBeNull();
});

it("does not fill Josh's reserved slot with Andrey posts when Josh has none", async () => {
  const sizov = Array.from({ length: 3 }, (_, index) => ({ ...item, id: `sizov${index}`, headline: `Andrey post ${index}` }));
  mockInsights.mockImplementation((params: string) => ({
    ...query, data: { items: params.includes("source=linville") ? [] : sizov, page: 1, hasMore: false },
  }));
  await render(<NewsScreen />);
  expect(screen.getByText("Andrey post 0")).toBeTruthy();
  expect(screen.getByText("Andrey post 1")).toBeTruthy();
  expect(screen.queryByText("Andrey post 2")).toBeNull();
  expect(screen.getByText("Няма достъпни публикации от Josh Linville в момента.")).toBeTruthy();
});

it("shows an explicit error if either author's query fails and retries both", async () => {
  mockInsights.mockImplementation((params: string) => ({
    ...query, isError: params.includes("source=linville"), data: { items: [item], page: 1, hasMore: false },
  }));
  await render(<NewsScreen />);
  expect(screen.queryByText("Пазар на пшеница")).toBeNull();
  expect(screen.getByText("Пазарните анализи не могат да бъдат заредени.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Опитай отново" }));
  expect(mockRefetch).toHaveBeenCalledTimes(2);
});

it("shows an explicit empty state when no insights are published", async () => {
  mockInsights.mockReturnValue({ ...query, data: { items: [], page: 1, hasMore: false } });
  await render(<NewsScreen />);
  expect(screen.getByText("Няма достъпни публикации от X в момента.")).toBeTruthy();
});

it("shows Josh Linville instead of his X username in news cards", async () => {
  mockInsights.mockReturnValue({ ...query, data: { items: [{
    ...item, source: { ...item.source, name: "jlinvillefert", url: "https://x.com/jlinvillefert/status/123" },
  }], page: 1, hasMore: false } });
  await render(<NewsScreen />);
  expect(screen.getByText("Josh Linville")).toBeTruthy();
  expect(screen.queryByText("jlinvillefert")).toBeNull();
});

it.each([null, "", "   "])("does not display untranslated posts (%s)", async (translation) => {
  mockInsights.mockReturnValue({ ...query, data: { items: [{ ...item, translation }], page: 1, hasMore: false } });
  await render(<NewsScreen />);
  expect(screen.queryByText("Пазар на пшеница")).toBeNull();
  expect(screen.getByText("Няма достъпни публикации от X в момента.")).toBeTruthy();
});

it("shows older saved posts with a last-check warning rather than dropping them", async () => {
  mockInsights.mockReturnValue({ ...query, data: { items: [{
    ...item, source: { ...item.source, publishedAt: "2026-01-01T12:00:00Z",
      checkOverdue: true, lastCheckedAt: "2026-11-14T12:00:00Z" },
  }], page: 1, hasMore: false } });
  await render(<NewsScreen />);
  expect(screen.getByText("Пазар на пшеница")).toBeTruthy();
  expect(screen.getByText(/Запазена публикация · последна проверка в X: 14.11.2026/)).toBeTruthy();
});

it("hides stale insights and offers retry if the backend cannot be reached", async () => {
  mockInsights.mockReturnValue({ ...query, isError: true, data: { items: [item], page: 1, hasMore: false } });
  await render(<NewsScreen />);
  expect(screen.queryByText("Пазарно обобщение")).toBeNull();
  expect(screen.getByText("Пазарните анализи не могат да бъдат заредени.")).toBeTruthy();
  await fireEvent.press(screen.getByText("Опитай отново"));
  expect(mockRefetch).toHaveBeenCalled();
});

it("keeps insights above USDA and refreshes both sources", async () => {
  const result = await render(<NewsScreen />);
  const tree = JSON.stringify(result.toJSON());
  expect(screen.getByText("Пазарно обобщение")).toBeTruthy();
  expect(screen.getByText("USDA report")).toBeTruthy();
  expect(tree.indexOf("Пазарно обобщение")).toBeLessThan(tree.indexOf("USDA report"));

  refreshScreen?.();
  expect(mockRefetch).toHaveBeenCalled();
  expect(mockWasdeRefetch).toHaveBeenCalled();
  expect(mockWeeklyRefetch).toHaveBeenCalled();
});

it("does not display non-X insights if an older backend ignores the platform filter", async () => {
  mockInsights.mockReturnValue({ ...query, data: { items: [
    { ...item, id: "other", headline: "Друг източник", source: { ...item.source, url: "https://example.com/post" } },
    item,
  ], page: 1, hasMore: false } });
  await render(<NewsScreen />);
  expect(screen.queryByText("Друг източник")).toBeNull();
  expect(screen.getByText("Пазар на пшеница")).toBeTruthy();
});

it("shows attributed fertilizer developments with a cautious trend and links to the analysis", async () => {
  const fertilizer = {
    ...item, id: "fert1", headline: "Фосфатните торове остават скъпи",
    summary: "FertilizerWeek описва високи цени на фосфатите.",
    analysis: "Вносът може да повлияе на разходите за торене.",
    fertilizerTags: ["DAP", "MAP"], direction: "UNCLEAR",
    source: { ...item.source, name: "FertilizerWeek", url: "https://x.com/FertilizerWeek1/status/12", publishedAt: "2026-11-19T12:00:00Z" },
  };
  mockInsights.mockImplementation((params: string) => ({
    ...query, data: { items: params.includes("source=FertilizerWeek") ? [fertilizer] : [item], page: 1, hasMore: false },
  }));
  await render(<NewsScreen />);
  expect(screen.getByText("DAP")).toBeTruthy();
  expect(screen.getByText("MAP")).toBeTruthy();
  expect(screen.getByText("Публикувано: 19.11.2026")).toBeTruthy();
  expect(screen.getByText(fertilizer.analysis)).toBeTruthy();
  expect(screen.getByText("Посока според AI: Недостатъчно данни")).toBeTruthy();
  expect(screen.getByText(/не е ценова котировка за България/)).toBeTruthy();
  expect(screen.queryByRole("link", { name: `Оригинал в X: ${fertilizer.headline}` })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `Виж новината: ${fertilizer.headline}` }));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/ai/insights/[id]", params: { id: "fert1" } });
});

it("filters the complete fertilizer query by product group and shows an explicit empty state", async () => {
  const source = { ...item.source, name: "FertilizerWeek", url: "https://x.com/FertilizerWeek1/status/12" };
  const nitrogen = { ...item, id: "n", headline: "Азотен пазар", fertilizerTags: ["UREA"], source };
  const phosphate = { ...item, id: "p", headline: "Фосфорен пазар", fertilizerTags: ["DAP"], source };
  mockInsights.mockImplementation((params: string) => ({
    ...query, data: { items: params.includes("source=FertilizerWeek") ? [nitrogen, phosphate] : [item], page: 1, hasMore: false },
  }));
  await render(<NewsScreen />);
  expect(screen.getByRole("tab", { name: "Всички", selected: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Азотни" }));
  expect(mockInsights).toHaveBeenCalledWith("page=1&platform=X&source=FertilizerWeek&pageSize=5&fertilizerGroup=nitrogen");
  expect(screen.getByRole("tab", { name: "Азотни", selected: true })).toBeTruthy();
  expect(screen.getByText("Азотен пазар")).toBeTruthy();
  expect(screen.queryByText("Фосфорен пазар")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Фосфорни" }));
  expect(mockInsights).toHaveBeenCalledWith("page=1&platform=X&source=FertilizerWeek&pageSize=5&fertilizerGroup=phosphate");
  expect(screen.getByText("Фосфорен пазар")).toBeTruthy();
  expect(screen.queryByText("Азотен пазар")).toBeNull();
  mockInsights.mockImplementation((params: string) => ({
    ...query, data: { items: params.includes("source=FertilizerWeek") ? [nitrogen] : [item], page: 1, hasMore: false },
  }));
  await fireEvent.press(screen.getByRole("tab", { name: "Всички" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Фосфорни" }));
  expect(screen.getByText("Няма наличен анализ за тази група торове.")).toBeTruthy();
});

it("does not show untranslatable or non-X fertilizer items", async () => {
  const source = { ...item.source, name: "FertilizerWeek", url: "https://x.com/FertilizerWeek1/status/12" };
  mockInsights.mockImplementation((params: string) => ({
    ...query, data: { items: params.includes("source=FertilizerWeek") ? [
      { ...item, id: "no-translation", headline: "Без превод", source, translation: null },
      { ...item, id: "wrong-source", headline: "Не е X", source: { ...source, url: "https://example.com/post" } },
    ] : [item], page: 1, hasMore: false },
  }));
  await render(<NewsScreen />);
  expect(screen.queryByText("Без превод")).toBeNull();
  expect(screen.queryByText("Не е X")).toBeNull();
  expect(screen.getByText("Няма наличен анализ от FertilizerWeek.")).toBeTruthy();
});
