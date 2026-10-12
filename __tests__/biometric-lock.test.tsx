import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { AppState, Button, Platform, Text, type AppStateStatus } from "react-native";

import { BiometricProvider, useBiometricLock } from "@/auth/BiometricContext";
import { biometricCapability, writeBiometricLock } from "@/lib/biometrics";
import { BiometricBoundary } from "@/ui/BiometricLock";

let mockStatus: "signedIn" | "signedOut" = "signedIn";
const mockSignOut = jest.fn();
jest.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ status: mockStatus, signOut: mockSignOut, dismissBiometricOffer: jest.fn() }),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  SecurityLevel: { BIOMETRIC_STRONG: 3, BIOMETRIC_WEAK: 2 },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/ui/AuthLayout", () => ({ Logo: () => null }));

const native = jest.mocked(LocalAuthentication);
const storage = jest.mocked(SecureStore);
let onState: (state: AppStateStatus) => void;

function Probe() {
  const lock = useBiometricLock();
  return (
    <>
      <Text testID="enabled">{String(lock.enabled)}</Text>
      <Text testID="ready">{String(lock.ready)}</Text>
      <Button title="Enable lock" onPress={() => void lock.setEnabled(true)} />
      <Button title="Disable lock" onPress={() => void lock.setEnabled(false)} />
      <BiometricBoundary><Text>Private screen</Text></BiometricBoundary>
    </>
  );
}

async function start(enabled = false) {
  // Existing manual-retry scenarios begin after a cancelled automatic prompt.
  if (enabled) native.authenticateAsync.mockResolvedValueOnce({ success: false, error: "user_cancel" });
  await writeBiometricLock(enabled);
  const result = await render(<BiometricProvider><Probe /></BiometricProvider>);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
  if (enabled) {
    await waitFor(() => expect(screen.getByText("Отключването е отменено. Опитай отново.")).toBeTruthy());
    native.authenticateAsync.mockClear();
  }
  return result;
}

async function changeState(state: AppStateStatus) {
  await act(() => {
    AppState.currentState = state;
    onState(state);
  });
}

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockStatus = "signedIn";
  jest.replaceProperty(Platform, "OS", "ios");
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((event, handler) => {
    if (event === "change") onState = handler;
    return { remove: jest.fn() };
  });
  native.hasHardwareAsync.mockResolvedValue(true);
  native.isEnrolledAsync.mockResolvedValue(true);
  native.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
  native.getEnrolledLevelAsync.mockResolvedValue(3);
  native.authenticateAsync.mockResolvedValue({ success: true });
  await writeBiometricLock(false);
});

it("leaves an existing session accessible when the feature is off", async () => {
  await start();
  expect(screen.getByText("Private screen")).toBeTruthy();
  expect(native.authenticateAsync).not.toHaveBeenCalled();
});

it("blocks private screens on cold launch until Face ID succeeds", async () => {
  await start(true);
  expect(screen.queryByText("Private screen")).toBeNull();
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  expect(screen.getByText("Private screen")).toBeTruthy();
  expect(native.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({
    disableDeviceFallback: false, biometricsSecurityLevel: "strong",
  }));
});

it("verifies identity before enabling and persists the preference", async () => {
  await start();
  await fireEvent.press(screen.getByText("Enable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("true");
  expect(storage.setItemAsync).toHaveBeenCalledWith("ag.biometric-lock", "1");
  expect(screen.getByText("Private screen")).toBeTruthy();
});

it("does not enable the lock when authentication is cancelled", async () => {
  await start();
  native.authenticateAsync.mockResolvedValue({ success: false, error: "user_cancel" });
  await fireEvent.press(screen.getByText("Enable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("false");
});

it("locks immediately when leaving the foreground and automatically unlocks on return", async () => {
  await start(true);
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  await changeState("inactive");
  expect(screen.queryByText("Private screen")).toBeNull();
  await changeState("background");
  await changeState("active");
  await waitFor(() => expect(screen.getByText("Private screen")).toBeTruthy());
  expect(native.authenticateAsync).toHaveBeenCalledTimes(2);
});

it("keeps cancellation, failures and retries behind the lock", async () => {
  await start(true);
  native.authenticateAsync.mockResolvedValue({ success: false, error: "user_cancel" });
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  expect(screen.queryByText("Private screen")).toBeNull();
  expect(screen.getByText("Отключването е отменено. Опитай отново.")).toBeTruthy();
  native.authenticateAsync.mockResolvedValue({ success: true });
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  expect(screen.getByText("Private screen")).toBeTruthy();
});

it("does not relock due to the Face ID prompt's own inactive transition", async () => {
  await start(true);
  native.authenticateAsync.mockImplementation(async () => {
    onState("inactive");
    onState("active");
    return { success: true };
  });
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  await waitFor(() => expect(screen.getByText("Private screen")).toBeTruthy());
});

it("rejects a late successful prompt after the app really backgrounds", async () => {
  await start(true);
  native.authenticateAsync.mockImplementation(async () => {
    onState("background");
    onState("active");
    return { success: true };
  });
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  expect(screen.queryByText("Private screen")).toBeNull();
});

it("requires authentication to disable the lock", async () => {
  await start(true);
  native.authenticateAsync.mockResolvedValue({ success: false, error: "authentication_failed" });
  await fireEvent.press(screen.getByText("Disable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("true");
  native.authenticateAsync.mockResolvedValue({ success: true });
  await fireEvent.press(screen.getByText("Disable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("false");
  expect(storage.deleteItemAsync).toHaveBeenCalledWith("ag.biometric-lock");
});

it("does not bypass an enabled lock when biometrics are no longer enrolled", async () => {
  native.isEnrolledAsync.mockResolvedValue(false);
  await start(true);
  expect(screen.queryByText("Private screen")).toBeNull();
  expect(screen.getByText("Изход")).toBeTruthy();
});

it("automatically requests Face ID on cold launch without a button tap", async () => {
  await writeBiometricLock(true);
  await render(<BiometricProvider><Probe /></BiometricProvider>);
  await waitFor(() => expect(screen.getByText("Private screen")).toBeTruthy());
  expect(native.authenticateAsync).toHaveBeenCalledTimes(1);
});

it("does not repeatedly prompt after cancellation or the prompt's inactive cycle", async () => {
  native.authenticateAsync.mockImplementationOnce(async () => {
    onState("inactive");
    onState("active");
    return { success: false, error: "user_cancel" };
  });
  await writeBiometricLock(true);
  await render(<BiometricProvider><Probe /></BiometricProvider>);
  await waitFor(() => expect(screen.getByText("Отключването е отменено. Опитай отново.")).toBeTruthy());
  expect(screen.queryByText("Private screen")).toBeNull();
  expect(native.authenticateAsync).toHaveBeenCalledTimes(1);
  await changeState("background");
  await changeState("active");
  await waitFor(() => expect(screen.getByText("Private screen")).toBeTruthy());
  expect(native.authenticateAsync).toHaveBeenCalledTimes(2);
});

it("never enables on unsupported devices", async () => {
  native.hasHardwareAsync.mockResolvedValue(false);
  await start();
  await fireEvent.press(screen.getByText("Enable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("false");
  expect(native.authenticateAsync).not.toHaveBeenCalled();
});

it("requires strong Android biometrics and identifies Touch ID on older iPhones", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  native.getEnrolledLevelAsync.mockResolvedValue(2);
  expect((await biometricCapability()).available).toBe(false);
  jest.replaceProperty(Platform, "OS", "ios");
  native.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
  expect((await biometricCapability()).label).toBe("Touch ID");
});

it("fails closed when the stored preference cannot be read", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  storage.getItemAsync.mockRejectedValueOnce(new Error("Keychain unavailable"));
  await render(<BiometricProvider><Probe /></BiometricProvider>);
  await waitFor(() => expect(screen.getByText("Опитай отново")).toBeTruthy());
  expect(screen.queryByText("Private screen")).toBeNull();
  expect(log).toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Опитай отново"));
  expect(screen.getByText("Private screen")).toBeTruthy();
});

it("keeps the lock enabled if disabling cannot be saved", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await start(true);
  storage.deleteItemAsync.mockRejectedValueOnce(new Error("Keychain unavailable"));
  await fireEvent.press(screen.getByText("Disable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("true");
  expect(screen.queryByText("Private screen")).toBeNull();
  expect(log).toHaveBeenCalled();
});

it("does not gate the signed-out login flow", async () => {
  mockStatus = "signedOut";
  await render(<BiometricProvider><Probe /></BiometricProvider>);
  expect(screen.getByText("Private screen")).toBeTruthy();
  expect(native.authenticateAsync).not.toHaveBeenCalled();
});

it("fails closed if the native authentication API throws", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await start(true);
  native.authenticateAsync.mockRejectedValueOnce(new Error("Native API unavailable"));
  await fireEvent.press(screen.getByText("Отключи с Face ID"));
  expect(screen.queryByText("Private screen")).toBeNull();
  expect(screen.getByText("Неуспешна проверка или запис. Опитай отново.")).toBeTruthy();
  expect(log).toHaveBeenCalled();
});

it("does not enable if persisting the preference fails", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await start();
  storage.setItemAsync.mockRejectedValueOnce(new Error("Keychain unavailable"));
  await fireEvent.press(screen.getByText("Enable lock"));
  expect(screen.getByTestId("enabled")).toHaveTextContent("false");
  expect(log).toHaveBeenCalled();
});

it("does not use unavailable SecureStore APIs on web", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  await start();
  expect(screen.getByText("Private screen")).toBeTruthy();
  expect(storage.getItemAsync).not.toHaveBeenCalled();
  expect((await biometricCapability()).available).toBe(false);
});

it("does not start multiple biometric prompts from repeated taps", async () => {
  await start();
  let finish!: (result: LocalAuthentication.LocalAuthenticationResult) => void;
  native.authenticateAsync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await fireEvent.press(screen.getByText("Enable lock"));
  await waitFor(() => expect(native.authenticateAsync).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByText("Enable lock"));
  expect(native.authenticateAsync).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ success: true }); });
  expect(screen.getByTestId("enabled")).toHaveTextContent("true");
});

it("does not enable a lock from a stale biometric result after logout", async () => {
  const view = await start();
  let finish!: (result: LocalAuthentication.LocalAuthenticationResult) => void;
  native.authenticateAsync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await fireEvent.press(screen.getByText("Enable lock"));
  await waitFor(() => expect(native.authenticateAsync).toHaveBeenCalled());
  mockStatus = "signedOut";
  await view.rerender(<BiometricProvider key="signedOut"><Probe /></BiometricProvider>);
  await act(async () => { finish({ success: true }); });
  expect(storage.setItemAsync).not.toHaveBeenCalledWith("ag.biometric-lock", "1");
});
