const mockSetUser = jest.fn();
const mockSetTag = jest.fn();
const mockSetContext = jest.fn();
const mockCaptureException = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  setUser: mockSetUser,
  setTag: mockSetTag,
  setContext: mockSetContext,
  withScope: (callback: (scope: object) => void) => callback({
    setTag: mockSetTag,
    setContext: mockSetContext,
    captureException: mockCaptureException,
  }),
}));
jest.mock("@/config", () => ({ APP_VERSION: "1.0.0" }));

let identifyUser: typeof import("@/lib/monitoring").identifyUser;
let reportError: typeof import("@/lib/monitoring").reportError;
const previousDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

beforeAll(() => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
  jest.isolateModules(() => {
    ({ identifyUser, reportError } = require("@/lib/monitoring"));
  });
});

afterAll(() => {
  if (previousDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  else process.env.EXPO_PUBLIC_SENTRY_DSN = previousDsn;
});

beforeEach(() => jest.clearAllMocks());

it("adds the internal ID, user number and admin profile path", () => {
  identifyUser({ id: "user-42", number: 42, role: "FARMER" });
  expect(mockSetUser).toHaveBeenCalledWith({ id: "42" });
  expect(mockSetTag).toHaveBeenCalledWith("user_id", "42");
  expect(mockSetTag).toHaveBeenCalledWith("internal_user_id", "user-42");
  expect(mockSetTag).toHaveBeenCalledWith("user_number", 42);
  expect(mockSetContext).toHaveBeenCalledWith("account", {
    id: "user-42", number: 42, role: "FARMER", admin_profile_path: "/admin/users/42",
  });
});

it("still identifies accounts when an older backend does not provide a number", () => {
  identifyUser({ id: "user-42", role: "TRADER" });
  expect(mockSetUser).toHaveBeenCalledWith({ id: "user-42" });
  expect(mockSetTag).toHaveBeenCalledWith("user_number", null);
});

it("clears identity on sign-out", () => {
  identifyUser(null);
  expect(mockSetUser).toHaveBeenCalledWith(null);
  expect(mockSetTag).toHaveBeenCalledWith("user_id", null);
  expect(mockSetTag).toHaveBeenCalledWith("internal_user_id", null);
  expect(mockSetTag).toHaveBeenCalledWith("user_number", null);
  expect(mockSetContext).toHaveBeenCalledWith("account", null);
});

it("captures errors after identification without replacing the account scope", () => {
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("Purchase verification failed");
  try {
    identifyUser({ id: "user-42", number: 42 });
    reportError("apple-purchases", error);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
    expect(mockSetUser).toHaveBeenCalledTimes(1);
  } finally {
    consoleSpy.mockRestore();
  }
});
