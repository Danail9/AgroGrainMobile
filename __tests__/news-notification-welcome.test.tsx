import { fireEvent, render, screen } from "@testing-library/react-native";
import { NewsNotificationWelcome } from "@/ui/NewsNotificationWelcome";

const mockMutate = jest.fn();
jest.mock("@/api/queries", () => ({
  useUpdatePrefs: () => ({ mutate: mockMutate, isPending: false }),
}));

beforeEach(() => jest.clearAllMocks());

it.each([
  ["Остави включени", true],
  ["Спри известията за новини", false],
])("saves the selected news setting when choosing %s", async (label, news) => {
  await render(<NewsNotificationWelcome />);
  expect(screen.getByText(/включени по подразбиране/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: label }));
  expect(mockMutate).toHaveBeenCalledWith(
    { news, newsPromptPending: false }, expect.objectContaining({ onError: expect.any(Function) }),
  );
});

it("keeps the choice visible and reports a failed save", async () => {
  mockMutate.mockImplementation((_patch, callbacks) => callbacks.onError(new Error("network")));
  await render(<NewsNotificationWelcome />);
  await fireEvent.press(screen.getByRole("button", { name: "Спри известията за новини" }));
  expect(screen.getByText(/Не успяхме да запазим избора/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Спри известията за новини" })).toBeTruthy();
});
