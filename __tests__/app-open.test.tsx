import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { api } from "@/api/client";
import { reportError } from "@/lib/monitoring";
import { AppOpenTracker } from "@/ui/AppOpenTracker";

let mockStatus = "signedIn";
jest.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ status: mockStatus }) }));
jest.mock("@/api/client", () => ({ api: jest.fn(async () => ({ logged: true })) }));
jest.mock("@/lib/monitoring", () => ({ reportError: jest.fn() }));

let change: (state: AppStateStatus) => void;
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = "signedIn";
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((event, handler) => {
    if (event === "change") change = handler;
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

it("records cold opens and foreground returns but not duplicate active events", async () => {
  const view = await render(<AppOpenTracker />);
  expect(api).toHaveBeenCalledWith("/app-open", expect.objectContaining({ method: "POST" }));
  await act(async () => { change("active"); change("background"); });
  expect(api).toHaveBeenCalledTimes(1);
  await act(async () => { change("active"); change("active"); });
  expect(api).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

it("waits until a background launch becomes active", async () => {
  AppState.currentState = "background";
  await render(<AppOpenTracker />);
  expect(api).not.toHaveBeenCalled();
  await act(async () => { change("active"); });
  expect(api).toHaveBeenCalledTimes(1);
});

it("starts only after authentication and stops when signed out", async () => {
  mockStatus = "signedOut";
  const view = await render(<AppOpenTracker />);
  expect(api).not.toHaveBeenCalled();
  mockStatus = "signedIn";
  await view.rerender(<AppOpenTracker />);
  expect(api).toHaveBeenCalledTimes(1);
  mockStatus = "signedOut";
  await view.rerender(<AppOpenTracker />);
  expect(remove).toHaveBeenCalled();
});

it("reports failed delivery without interrupting the app", async () => {
  const error = new Error("offline");
  jest.mocked(api).mockRejectedValueOnce(error);
  await render(<AppOpenTracker />);
  expect(reportError).toHaveBeenCalledWith("Recording app open failed", error);
});
