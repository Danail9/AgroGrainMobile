import { fireEvent, render, screen } from "@testing-library/react-native";

import { BiometricOffer } from "@/ui/BiometricLock";

const mockDismiss = jest.fn();
const mockEnable = jest.fn();
let mockOffer = true;
let mockEnabled = false;
let mockAvailable = true;
let mockError: string | null = null;

jest.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ status: "signedIn", offerBiometrics: mockOffer, dismissBiometricOffer: mockDismiss }),
}));
jest.mock("@/auth/BiometricContext", () => ({
  useBiometricLock: () => ({
    ready: true, locked: false, enabled: mockEnabled, busy: false, error: mockError,
    capability: { available: mockAvailable, label: "Face ID" }, setEnabled: mockEnable,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockOffer = true;
  mockEnabled = false;
  mockAvailable = true;
  mockError = null;
});

it("offers optional Face ID and requests authenticated enrollment", async () => {
  await render(<BiometricOffer />);
  expect(screen.getByText("По-бърз достъп с Face ID")).toBeTruthy();
  await fireEvent.press(screen.getByText("Включи Face ID"));
  expect(mockEnable).toHaveBeenCalledWith(true);
  expect(mockDismiss).not.toHaveBeenCalled();
});

it("lets users skip without enabling the lock", async () => {
  await render(<BiometricOffer />);
  await fireEvent.press(screen.getByText("Не сега"));
  expect(mockDismiss).toHaveBeenCalled();
  expect(mockEnable).not.toHaveBeenCalled();
});

it("does not show for enabled, unsupported or previously dismissed offers", async () => {
  mockEnabled = true;
  const view = await render(<BiometricOffer />);
  expect(screen.queryByText("Включи Face ID")).toBeNull();
  mockEnabled = false;
  mockAvailable = false;
  await view.rerender(<BiometricOffer />);
  expect(screen.queryByText("Включи Face ID")).toBeNull();
  mockAvailable = true;
  mockOffer = false;
  await view.rerender(<BiometricOffer />);
  expect(screen.queryByText("Включи Face ID")).toBeNull();
});

it("shows cancellation or storage errors while keeping retry and skip available", async () => {
  mockError = "Неуспешна проверка или запис. Опитай отново.";
  await render(<BiometricOffer />);
  expect(screen.getByText(mockError)).toBeTruthy();
  expect(screen.getByText("Включи Face ID")).toBeTruthy();
  expect(screen.getByText("Не сега")).toBeTruthy();
});
