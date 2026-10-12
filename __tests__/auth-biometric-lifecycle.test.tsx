import { fireEvent, render, screen, waitFor, act } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Button, Text } from "react-native";

import { api, configureApi } from "@/api/client";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { readBiometricLock, writeBiometricLock } from "@/lib/biometrics";

jest.mock("@/api/client", () => ({ api: jest.fn(async () => ({})), configureApi: jest.fn() }));
jest.mock("@/api/queryClient", () => ({ clearCache: jest.fn(async () => undefined) }));
jest.mock("@/lib/push", () => ({ disablePush: jest.fn(async () => undefined) }));

function Probe() {
  const auth = useAuth();
  return (
    <>
      <Text>{auth.status}</Text>
      <Text testID="offer">{String(auth.offerBiometrics)}</Text>
      <Button title="Logout" onPress={() => void auth.signOut()} />
      <Button title="Dismiss offer" onPress={auth.dismissBiometricOffer} />
      <Button title="Login" onPress={() => void auth.signIn("test@example.com", "password")} />
      <Button title="Register" onPress={() => void auth.register({
        name: "Test", email: "test@example.com", password: "password", confirm: "password",
        farmName: "Farm", phoneCode: "+359", phone: "888123456", role: "FARMER",
        regionSlug: "dobrich", settlement: "",
      })} />
      <Button title="Social login" onPress={() => void auth.socialSignIn({ provider: "google", idToken: "id-token" })} />
      <Button title="Renew session" onPress={() => void auth.adoptSession({
        token: "new-token", expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })} />
    </>
  );
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(api).mockResolvedValue({
    token: "new-token", expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await SecureStore.deleteItemAsync("ag.session");
  await writeBiometricLock(true);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

async function startWithSession() {
  await SecureStore.setItemAsync("ag.session", JSON.stringify({
    token: "session-token",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  }));
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("signedIn")).toBeTruthy());
}

it("clears the biometric preference on explicit logout", async () => {
  await startWithSession();
  await fireEvent.press(screen.getByText("Logout"));
  await waitFor(() => expect(screen.getByText("signedOut")).toBeTruthy());
  expect(await readBiometricLock()).toBe(false);
});

it("clears the biometric preference when the server revokes the session", async () => {
  await startWithSession();
  const callbacks = jest.mocked(configureApi).mock.calls[0][0];
  await act(async () => { callbacks.onUnauthorized(); });
  await waitFor(() => expect(screen.getByText("signedOut")).toBeTruthy());
  expect(await readBiometricLock()).toBe(false);
});

it("does not retain another account's biometric setting after session expiry", async () => {
  await SecureStore.setItemAsync("ag.session", JSON.stringify({
    token: "expired-token", expiresAt: "2000-01-01T00:00:00.000Z",
  }));
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("signedOut")).toBeTruthy());
  expect(await readBiometricLock()).toBe(false);
});

it.each(["Login", "Register", "Social login"])("offers biometrics after %s and allows skipping", async (button) => {
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("signedOut")).toBeTruthy());
  expect(screen.getByTestId("offer")).toHaveTextContent("false");
  await fireEvent.press(screen.getByText(button));
  await waitFor(() => expect(screen.getByText("signedIn")).toBeTruthy());
  expect(screen.getByTestId("offer")).toHaveTextContent("true");
  await fireEvent.press(screen.getByText("Dismiss offer"));
  expect(screen.getByTestId("offer")).toHaveTextContent("false");
});

it("does not offer biometrics on session restoration or renewal", async () => {
  await startWithSession();
  expect(screen.getByTestId("offer")).toHaveTextContent("false");
  await fireEvent.press(screen.getByText("Renew session"));
  expect(screen.getByTestId("offer")).toHaveTextContent("false");
});

it("does not offer biometrics before a social profile is completed", async () => {
  jest.mocked(api).mockResolvedValueOnce({ needsProfile: true, email: "new@example.com", name: "Test" });
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("signedOut")).toBeTruthy());
  await fireEvent.press(screen.getByText("Social login"));
  expect(screen.getByTestId("offer")).toHaveTextContent("false");
});
