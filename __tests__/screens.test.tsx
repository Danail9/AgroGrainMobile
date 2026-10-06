import { fireEvent, render, screen } from "@testing-library/react-native";

import { ApiClientError, api } from "@/api/client";
import ResetPasswordScreen from "@/app/(auth)/reset-password";

let mockParams: { token?: string } = { token: "tok-123" };

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/api/client", () => {
  const actual = jest.requireActual("@/api/client");
  return { ...actual, api: jest.fn() };
});

const mockApi = api as jest.Mock;

beforeEach(() => {
  mockParams = { token: "tok-123" };
  mockApi.mockReset();
});

describe("reset password screen", () => {
  it("asks for a new link when the token is missing", async () => {
    mockParams = {};
    await render(<ResetPasswordScreen />);
    expect(screen.getByText("Невалиден линк")).toBeTruthy();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("sends the token with the new password and confirms success", async () => {
    mockApi.mockResolvedValue({ reset: true });
    await render(<ResetPasswordScreen />);

    await fireEvent.changeText(screen.getByLabelText("Нова парола"), "newpass123");
    await fireEvent.changeText(screen.getByLabelText("Повтори паролата"), "newpass123");
    await fireEvent.press(screen.getByText("Запази паролата"));

    expect(mockApi).toHaveBeenCalledWith(
      "/auth/password/reset",
      expect.objectContaining({
        method: "POST",
        body: { token: "tok-123", password: "newpass123", confirm: "newpass123" },
        auth: false,
      }),
    );
    expect(await screen.findByText(/Паролата е сменена/)).toBeTruthy();
  });

  it("shows the server's message when the link has expired", async () => {
    mockApi.mockRejectedValue(new ApiClientError("validation_failed", "Линкът е изтекъл.", { status: 400 }));
    await render(<ResetPasswordScreen />);

    await fireEvent.changeText(screen.getByLabelText("Нова парола"), "newpass123");
    await fireEvent.changeText(screen.getByLabelText("Повтори паролата"), "newpass123");
    await fireEvent.press(screen.getByText("Запази паролата"));

    expect(await screen.findByText("Линкът е изтекъл.")).toBeTruthy();
  });
});
