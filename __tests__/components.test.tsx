import type { UseQueryResult } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ApiClientError } from "@/api/client";
import * as Dialog from "@/ui/Dialog";
import { GATE_COPY, Gate } from "@/ui/Gate";
import { ChangeBadge, Pill, SampleSpecs, UnreadBadge } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { DeleteAccountForm } from "@/ui/SettingsForms";
import { ScreenHeader } from "@/ui/Screen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ signOut: jest.fn() }) }));

function query(partial: Partial<UseQueryResult<string, Error>>) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
    isRefetching: false,
    fetchStatus: "idle",
    dataUpdatedAt: 0,
    refetch: jest.fn(),
    ...partial,
  } as unknown as UseQueryResult<string, Error>;
}

const body = (data: string) => <Text>{`DATA:${data}`}</Text>;

describe("header name wrapping", () => {
  it("allows long home greetings to wrap without truncation", async () => {
    const title = "Добър вечер, Dobromir!";
    await render(<ScreenHeader title={title} wrapTitle />);
    expect(screen.getByText(title).props.numberOfLines).toBeUndefined();
  });

  it("preserves single-line titles for other screens", async () => {
    await render(<ScreenHeader title="Профил" />);
    expect(screen.getByText("Профил").props.numberOfLines).toBe(1);
  });
});

describe("QueryBoundary", () => {
  it("shows the screen when data is present", async () => {
    await render(<QueryBoundary query={query({ data: "x" })}>{body}</QueryBoundary>);
    expect(screen.getByText("DATA:x")).toBeTruthy();
    expect(screen.queryByText(/Няма връзка/)).toBeNull();
  });

  it("keeps showing cached data and says so when the phone is offline", async () => {
    await render(
      <QueryBoundary query={query({ data: "cached", fetchStatus: "paused", dataUpdatedAt: Date.now() - 2 * 3_600_000 })}>
        {body}
      </QueryBoundary>,
    );
    expect(screen.getByText("DATA:cached")).toBeTruthy();
    expect(screen.getByText(/Няма връзка · показваме последните заредени данни/)).toBeTruthy();
    // The staleness stamp tells the farmer how old the numbers are.
    expect(screen.getByText("обновено преди 2 часа")).toBeTruthy();
  });

  it("flags a failed refresh without hiding the cached data", async () => {
    await render(
      <QueryBoundary query={query({ data: "cached", isError: true, error: new Error("x") })}>
        {body}
      </QueryBoundary>,
    );
    expect(screen.getByText("DATA:cached")).toBeTruthy();
    expect(screen.getByText(/Не успяхме да обновим данните/)).toBeTruthy();
  });

  it("says plainly that there is no connection when nothing is cached", async () => {
    await render(<QueryBoundary query={query({ isPending: true, fetchStatus: "paused" })}>{body}</QueryBoundary>);
    expect(screen.getByText("Няма връзка")).toBeTruthy();
    expect(screen.getByText("Свържи се с интернет, за да заредиш данните.")).toBeTruthy();
  });

  it("shows a spinner while the first load is in flight", async () => {
    await render(<QueryBoundary query={query({ isPending: true, fetchStatus: "fetching" })}>{body}</QueryBoundary>);
    expect(screen.getByLabelText("Зарежда се")).toBeTruthy();
  });

  it("shows the server's own message with a working retry", async () => {
    const refetch = jest.fn();
    await render(
      <QueryBoundary
        query={query({
          isError: true,
          error: new ApiClientError("server_error", "Сървърът не отговаря. Опитай отново."),
          refetch,
        })}
      >
        {body}
      </QueryBoundary>,
    );
    expect(screen.getByText("Сървърът не отговаря. Опитай отново.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Опитай отново"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("reader-app gates", () => {
  const gates = Object.entries(GATE_COPY);

  it.each(gates)("%s renders its title and message", async (_name, copy) => {
    await render(<Gate icon="lock-closed-outline" title={copy.title} message={copy.message} />);
    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(screen.getByText(copy.message)).toBeTruthy();
  });

  it.each(gates)(
    "%s contains no price, currency, plan comparison, purchase wording or link",
    async (_name, copy) => {
      await render(<Gate icon="lock-closed-outline" title={copy.title} message={copy.message} />);
      const text = JSON.stringify(screen.toJSON());
      expect(text).not.toMatch(/€|евро|EUR|d+s?(лв|BGN)|цена|купи|закупи|плати|покупк/i);
      expect(text).not.toMatch(/https?:|www.|.bg|.com/i);
    },
  );

  it("the trade gate matches the message the server sends", async () => {
    expect(GATE_COPY.noTrade.message).toBe("Този раздел не е включен в плана ти.");
  });
});

describe("primitives", () => {
  it("ChangeBadge shows a neutral dash when there is nothing to compare", async () => {
    await render(<ChangeBadge value={null} />);
    expect(screen.getByText("–")).toBeTruthy();
  });

  it("ChangeBadge formats the change", async () => {
    await render(<ChangeBadge value={-3.25} variant="plain" />);
    expect(screen.getByText("↓ 3,3%")).toBeTruthy();
  });

  it("UnreadBadge caps at 9+ and hides at zero", async () => {
    const { rerender } = await render(<UnreadBadge count={42} />);
    expect(screen.getByText("9+")).toBeTruthy();
    await rerender(<UnreadBadge count={0} />);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("SampleSpecs renders only the declared measurements", async () => {
    await render(<SampleSpecs hectolitre={78} protein={null} gluten={24} />);
    expect(screen.getByText("78 кг/хл")).toBeTruthy();
    expect(screen.getByText("24%")).toBeTruthy();
    expect(screen.queryByText(/Протеин/)).toBeNull();
  });

  it("SampleSpecs renders nothing when none were declared", async () => {
    await render(<SampleSpecs hectolitre={null} protein={null} gluten={null} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("Pill renders its label", async () => {
    await render(<Pill tone="brand">Активна</Pill>);
    expect(screen.getByText("Активна")).toBeTruthy();
  });
});

describe("DeleteAccountForm", () => {
  it("stays collapsed until asked, then needs the password before it can be used", async () => {
    await render(<DeleteAccountForm />);
    expect(screen.queryByText("Паролата ти")).toBeNull();

    await fireEvent.press(screen.getByText("Изтрий профила"));
    expect(screen.getByText("Паролата ти")).toBeTruthy();
    const alert = jest.spyOn(Dialog, "showDialog").mockImplementation(() => undefined);
    await fireEvent.press(screen.getByText("Изтрий профила окончателно"));
    expect(alert).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "secret123");
    await fireEvent.press(screen.getByText("Изтрий профила окончателно"));
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
