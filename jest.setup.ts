jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(async () => ({ isConnected: true })),
}));

jest.mock("expo-iap", () => ({
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  fetchProducts: jest.fn(),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(),
  getPendingTransactionsIOS: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  syncIOS: jest.fn(),
  showManageSubscriptionsIOS: jest.fn(),
  ErrorCode: { UserCancelled: "user-cancelled", Pending: "pending", DeferredPayment: "deferred-payment" },
}));
