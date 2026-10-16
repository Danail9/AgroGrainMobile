import * as SDK from "expo-iap";
import type { PurchaseIOS } from "expo-iap";
import { Platform } from "react-native";
import {
  buyApplePlan, loadApplePlans, restoreApplePurchases, syncApplePurchases,
  manageAppleSubscription, isApplePurchaseCancelled, stopApplePurchases,
} from "@/lib/apple-purchases";

const mockApi = jest.fn();
jest.mock("@/api/client", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock("expo-constants", () => ({
  __esModule: true, default: { executionEnvironment: "standalone" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
const token = "12345678-1234-4123-8123-123456789012";
const identity = { appAccountToken: token, products: { month: "monthly", year: "yearly" } };
const month = {
  id: "monthly", displayPrice: "49,99 €", platform: "ios", type: "subs",
  currency: "EUR", description: "Full access", title: "Monthly", displayNameIOS: "Monthly",
  isFamilyShareableIOS: false, jsonRepresentationIOS: "{}", typeIOS: "auto-renewable-subscription",
  introductoryPricePaymentModeIOS: "empty",
} as const;
const year = { ...month, id: "yearly", displayPrice: "499,99 €" };
const purchase: PurchaseIOS = {
  id: "tx1", transactionId: "tx1", productId: month.id, purchaseToken: "signed.apple.jws",
  purchaseState: "purchased", store: "apple", storeId: "apple", transactionDate: Date.now(),
  quantity: 1, isAutoRenewing: true, appAccountToken: token,
};
const state = {
  appleActive: false, canPurchase: true,
  subscription: { active: false, canTrade: false, exempt: false, freeAccess: false,
    status: "NONE", interval: null, tier: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
};
let update: Parameters<typeof SDK.purchaseUpdatedListener>[0];
let storeError: Parameters<typeof SDK.purchaseErrorListener>[0];
const sdk = jest.mocked(SDK);
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "ios");
  mockApi.mockImplementation(async (_path, options) => options?.method === "POST" ? state : identity);
  sdk.purchaseUpdatedListener.mockImplementation((listener) => { update = listener; return { remove: jest.fn() }; });
  sdk.purchaseErrorListener.mockImplementation((listener) => { storeError = listener; return { remove: jest.fn() }; });
  sdk.initConnection.mockResolvedValue(true);
  sdk.fetchProducts.mockResolvedValue([month, year]);
  sdk.requestPurchase.mockResolvedValue(null);
  sdk.getPendingTransactionsIOS.mockResolvedValue([]);
  sdk.getAvailablePurchases.mockResolvedValue([]);
  sdk.finishTransaction.mockResolvedValue(undefined);
  sdk.syncIOS.mockResolvedValue(true);
});
afterEach(async () => { stopApplePurchases(); await Promise.resolve(); jest.restoreAllMocks(); });

function emitOnRequest(event = purchase) {
  sdk.requestPurchase.mockImplementation(async () => { update(event); return null; });
}
function verifiedServer() {
  mockApi.mockImplementation(async (_path, options) => options?.method === "POST"
    ? { ...state, appleActive: Boolean(options.body.signedTransaction) } : identity);
}
it("loads localized StoreKit prices without public API keys or Stripe", async () => {
  const plans = await loadApplePlans();
  expect(plans.month.displayPrice).toBe("49,99 €");
  expect(sdk.fetchProducts).toHaveBeenCalledWith({ skus: ["monthly", "yearly"], type: "subs" });
  expect(mockApi.mock.calls.map((call) => call[0])).not.toContain("/subscription/checkout");
});
it("requires both Apple products", async () => {
  sdk.fetchProducts.mockResolvedValue([month]);
  await expect(loadApplePlans()).rejects.toThrow("плановете не са налични");
});
it("blocks non-iOS purchases before loading the native module", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  await expect(loadApplePlans()).rejects.toThrow("само на iOS");
  expect(sdk.initConnection).not.toHaveBeenCalled();
});
it.each([
  [{ ...state, canPurchase: false }, "Не е започната"],
  [{ ...state, appleActive: true }, "Вече имаш Apple"],
])("prevents duplicate billing", async (before, message) => {
  mockApi.mockImplementation(async (_path, options) => options?.method === "POST" ? before : identity);
  await expect(buyApplePlan(month)).rejects.toThrow(message);
  expect(sdk.requestPurchase).not.toHaveBeenCalled();
});
it("finishes only after signed server verification and binds purchases to the account UUID", async () => {
  verifiedServer();
  sdk.finishTransaction.mockImplementation(async () => {
    expect(mockApi).toHaveBeenLastCalledWith("/subscription/apple", expect.objectContaining({
      body: { appAccountToken: token, signedTransaction: purchase.purchaseToken },
    }));
  });
  emitOnRequest();
  expect((await buyApplePlan(month)).appleActive).toBe(true);
  expect(sdk.requestPurchase).toHaveBeenCalledWith({
    type: "subs", request: { apple: {
      sku: month.id, appAccountToken: token, andDangerouslyFinishTransactionAutomatically: false,
    } },
  });
  expect(sdk.finishTransaction).toHaveBeenCalledTimes(1);
});
it("does not trust requestPurchase's return value", async () => {
  const cancelled = { name: "PurchaseError", code: SDK.ErrorCode.UserCancelled, message: "Cancelled" };
  sdk.requestPurchase.mockImplementation(async () => { storeError(cancelled); return purchase; });
  await expect(buyApplePlan(month)).rejects.toEqual(cancelled);
  expect(isApplePurchaseCancelled(cancelled)).toBe(true);
  expect(sdk.finishTransaction).not.toHaveBeenCalled();
});
it("leaves failed verification unfinished and warns not to pay again", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  mockApi.mockImplementation(async (_path, options) => {
    if (options?.body?.signedTransaction) throw new Error("offline");
    return options?.method === "POST" ? state : identity;
  });
  emitOnRequest();
  await expect(buyApplePlan(month)).rejects.toThrow("Не плащай повторно");
  expect(sdk.finishTransaction).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalled();
});
it("does not verify or finish a pending approval", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  emitOnRequest({ ...purchase, purchaseState: "pending" });
  await expect(buyApplePlan(month)).rejects.toThrow("очаква одобрение");
  expect(sdk.finishTransaction).not.toHaveBeenCalled();
});
it("rejects account switches during a purchase", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  sdk.requestPurchase.mockImplementation(async () => {
    mockApi.mockResolvedValue({ ...identity, appAccountToken: "changed" });
    update(purchase);
    return null;
  });
  await expect(buyApplePlan(month)).rejects.toThrow("Профилът е сменен");
  expect(sdk.finishTransaction).not.toHaveBeenCalled();
});
it("retries unfinished StoreKit transactions on launch without prompting for restoration", async () => {
  verifiedServer();
  sdk.getPendingTransactionsIOS.mockResolvedValue([purchase]);
  await syncApplePurchases();
  expect(sdk.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: false });
  expect(sdk.syncIOS).not.toHaveBeenCalled();
});
it("restores through StoreKit sync and requires active server-confirmed access", async () => {
  let restored = false;
  mockApi.mockImplementation(async (_path, options) => {
    if (options?.body?.signedTransaction) restored = true;
    return options?.method === "POST" ? { ...state, appleActive: restored } : identity;
  });
  await expect(restoreApplePurchases()).rejects.toThrow("Няма активна");
  sdk.getAvailablePurchases.mockResolvedValue([purchase]);
  expect((await restoreApplePurchases()).appleActive).toBe(true);
  expect(sdk.syncIOS).toHaveBeenCalledTimes(2);
});
it("opens native App Store subscription management", async () => {
  await manageAppleSubscription();
  expect(sdk.showManageSubscriptionsIOS).toHaveBeenCalledTimes(1);
});
it("does not finish another account's restored purchase", async () => {
  mockApi.mockImplementation(async (_path, options) => {
    if (options?.body?.signedTransaction) throw new Error("Покупката принадлежи на друг профил.");
    return options?.method === "POST" ? state : identity;
  });
  sdk.getAvailablePurchases.mockResolvedValue([purchase]);
  await expect(restoreApplePurchases()).rejects.toThrow("друг профил");
  expect(sdk.finishTransaction).not.toHaveBeenCalled();
});
it("blocks a new payment if an unfinished transaction cannot be verified", async () => {
  sdk.getPendingTransactionsIOS.mockResolvedValue([purchase]);
  mockApi.mockImplementation(async (_path, options) => {
    if (options?.body?.signedTransaction) throw new Error("verification unavailable");
    return options?.method === "POST" ? state : identity;
  });
  await expect(buyApplePlan(month)).rejects.toThrow("verification unavailable");
  expect(sdk.requestPurchase).not.toHaveBeenCalled();
  expect(sdk.finishTransaction).not.toHaveBeenCalled();
});
it("deduplicates simultaneous transaction events before finishing", async () => {
  verifiedServer();
  sdk.requestPurchase.mockImplementation(async () => {
    update(purchase);
    update(purchase);
    return null;
  });
  expect((await buyApplePlan(month)).appleActive).toBe(true);
  expect(sdk.finishTransaction).toHaveBeenCalledTimes(1);
});
it("removes StoreKit listeners and reconnects after an account change", async () => {
  await loadApplePlans();
  const removePurchase = sdk.purchaseUpdatedListener.mock.results[0].value.remove;
  const removeError = sdk.purchaseErrorListener.mock.results[0].value.remove;
  stopApplePurchases();
  await loadApplePlans();
  expect(removePurchase).toHaveBeenCalledTimes(1);
  expect(removeError).toHaveBeenCalledTimes(1);
  expect(sdk.endConnection).toHaveBeenCalledTimes(1);
  expect(sdk.initConnection).toHaveBeenCalledTimes(2);
});
