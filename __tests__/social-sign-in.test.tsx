import { fireEvent, render, screen } from "@testing-library/react-native";

import CompleteProfileScreen from "@/app/(auth)/complete-profile";
import * as social from "@/lib/social-sign-in";
import { SocialButtons } from "@/ui/SocialButtons";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSocialSignIn = jest.fn();
const mockComplete = jest.fn();
let mockPending = true;

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ email: "ivan@gmail.com", name: "Иван Петров" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    socialSignIn: mockSocialSignIn,
    completeSocialProfile: mockComplete,
    hasPendingSocial: () => mockPending,
  }),
}));
jest.mock("@/api/queries", () => ({ useRegions: () => ({ data: undefined }) }));
jest.mock("@/lib/social-sign-in", () => {
  class SocialSignInError extends Error {}
  return {
    SocialSignInError,
    isGoogleConfigured: jest.fn(() => false),
    isAppleAvailable: jest.fn(async () => false),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
  };
});
jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 2 },
}));

const mocked = social as jest.Mocked<typeof social>;

beforeEach(() => {
  jest.clearAllMocks();
  mockPending = true;
  mocked.isGoogleConfigured.mockReturnValue(false);
  mocked.isAppleAvailable.mockResolvedValue(false);
});

describe("SocialButtons", () => {
  it("renders nothing when no provider is configured", async () => {
    await render(<SocialButtons />);
    expect(screen.queryByText("Продължи с Google")).toBeNull();
    expect(screen.queryByText("или")).toBeNull();
  });

  it("sends a new Google user to finish the profile", async () => {
    mocked.isGoogleConfigured.mockReturnValue(true);
    mocked.signInWithGoogle.mockResolvedValue({ provider: "google", idToken: "tok" });
    mockSocialSignIn.mockResolvedValue({
      status: "needsProfile",
      email: "ivan@gmail.com",
      name: "Иван",
    });
    await render(<SocialButtons />);
    await fireEvent.press(screen.getByText("Продължи с Google"));
    expect(mockSocialSignIn).toHaveBeenCalledWith({ provider: "google", idToken: "tok" });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/complete-profile",
      params: { email: "ivan@gmail.com", name: "Иван" },
    });
  });

  it("does nothing when the user cancels the Google sheet", async () => {
    mocked.isGoogleConfigured.mockReturnValue(true);
    mocked.signInWithGoogle.mockResolvedValue(null);
    await render(<SocialButtons />);
    await fireEvent.press(screen.getByText("Продължи с Google"));
    expect(mockSocialSignIn).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the sign-in error", async () => {
    mocked.isGoogleConfigured.mockReturnValue(true);
    mocked.signInWithGoogle.mockRejectedValue(new social.SocialSignInError("Няма връзка с Google."));
    await render(<SocialButtons />);
    await fireEvent.press(screen.getByText("Продължи с Google"));
    expect(screen.getByText("Няма връзка с Google.")).toBeTruthy();
  });
});

describe("CompleteProfileScreen", () => {
  it("prefills the name and submits the profile", async () => {
    mockComplete.mockResolvedValue(undefined);
    await render(<CompleteProfileScreen />);
    expect(screen.getByText("ivan@gmail.com")).toBeTruthy();
    expect(screen.getByDisplayValue("Иван Петров")).toBeTruthy();
    await fireEvent.press(screen.getByText("Търговец"));
    await fireEvent.press(screen.getByText("Създай профил"));
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Иван Петров", role: "TRADER", regionSlug: "dobrich" }),
    );
  });

  it("sends the user back to login when the sign-in expired", async () => {
    mockPending = false;
    await render(<CompleteProfileScreen />);
    await fireEvent.press(screen.getByText("Към входа"));
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
