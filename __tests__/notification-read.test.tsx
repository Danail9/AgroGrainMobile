import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { api } from "@/api/client";
import { keys, useClearNotifications, useMarkAllRead, useMarkRead } from "@/api/queries";

jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  api: jest.fn(),
}));

describe("notification badge updates", () => {
  it.each([
    ["opening one", () => {
      const mutation = useMarkRead();
      return () => mutation.mutateAsync("notification-1");
    }],
    ["reading all", () => {
      const mutation = useMarkAllRead();
      return () => mutation.mutateAsync();
    }],
    ["clearing all", () => {
      const mutation = useClearNotifications();
      return () => mutation.mutateAsync();
    }],
  ] as const)("refreshes Home after %s notification action", async (_name, hook) => {
    jest.mocked(api).mockResolvedValue({});
    const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(hook, { wrapper });
    await act(async () => {
      await result.current();
    });
    for (const queryKey of [keys.notifications, keys.me, keys.home]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    unmount();
    client.clear();
  });
});
