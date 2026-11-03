import { fireEvent, render, screen } from "@testing-library/react-native";
import ChatScreen from "@/app/(app)/ai/chat";
const mockSend = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}) }));
jest.mock("@/lib/voice", () => ({ voiceSupported: false }));
jest.mock("@/lib/monitoring", () => ({ reportError: jest.fn() }));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/api/queries", () => ({ sendChat: (...args: unknown[]) => mockSend(...args),
  useMe: () => ({ data: { user: { regionName: "Добрич" } } }) }));
it("retries the same failed question without inserting an error reply or duplicate user turn", async () => {
  mockSend.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ content: "Answer" });
  await render(<ChatScreen />);
  await fireEvent.changeText(screen.getByLabelText("Въпрос към AgroGrain AI"), "Question");
  await fireEvent.press(screen.getByRole("button", { name: "Изпрати" }));
  expect(await screen.findByText(/В момента не мога/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Опитай отново" }));
  expect(await screen.findByText("Answer")).toBeTruthy();
  expect(mockSend.mock.calls[0][0]).toEqual([{ role: "user", content: "Question" }]);
  expect(mockSend.mock.calls[1][0]).toEqual(mockSend.mock.calls[0][0]);
});
