import Constants, { ExecutionEnvironment } from "expo-constants";
import type { ProductSubscription, Purchase } from "expo-iap";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import { z } from "zod";

import { api } from "@/api/client";
import { subscriptionSchema } from "@/api/schemas";
import { reportError } from "@/lib/monitoring";

const identitySchema = z.object({
  appAccountToken: z.uuid(),
  products: z.object({ month: z.string().min(1), year: z.string().min(1) }),
});
const syncSchema = z.object({
  appleActive: z.boolean(), canPurchase: z.boolean(), subscription: subscriptionSchema,
});
type Identity = z.infer<typeof identitySchema>;
type State = z.infer<typeof syncSchema>;
type StoreKit = typeof import("expo-iap");
let connection: Promise<StoreKit> | null = null;
let closing: Promise<unknown> = Promise.resolve();
let generation = 0;
let listeners: { remove: () => void }[] = [];
let queue: Promise<unknown> = Promise.resolve();
const processing = new Map<string, Promise<State>>();
const observers = new Set<() => void>();
export type ApplePurchaseStage = "store" | "verifying";
let requested: {
  sku: string; token: string; resolve: (state: State) => void; reject: (error: unknown) => void;
  onStage?: (stage: ApplePurchaseStage) => void;
} | null = null;

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result;
  return result;
}

export function applePurchasesAvailable() {
  if (Platform.OS !== "ios" || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }
  if (process.env.NODE_ENV === "test") return true;
  try {
    return Boolean(requireOptionalNativeModule("ExpoIap"));
  } catch {
    return false;
  }
}

function identity() {
  return api("/subscription/apple", { schema: identitySchema });
}

async function serverSync(token: string, signedTransaction?: string) {
  const current = await identity();
  if (current.appAccountToken !== token) throw new Error("Профилът е сменен по време на покупката. Влез отново.");
  return api("/subscription/apple", {
    method: "POST", body: { appAccountToken: token, signedTransaction }, schema: syncSchema,
  });
}

function pendingError() {
  return new Error("Apple покупката очаква одобрение. Достъпът ще се обнови след потвърждение. Не плащай повторно.");
}

async function confirmPurchase(store: StoreKit, purchase: Purchase, account: Identity) {
  if (purchase.purchaseState === "pending") throw pendingError();
  const signedTransaction = purchase.purchaseToken;
  if (purchase.purchaseState !== "purchased" || !signedTransaction) {
    throw new Error("Apple транзакцията няма подписано потвърждение. Използвай „Възстанови покупки“.");
  }
  const key = `${account.appAccountToken}:${purchase.id}`;
  const existing = processing.get(key);
  if (existing) return existing;
  const confirmation = (async () => {
    try {
      const parts = signedTransaction.split(".");
      if (parts[1]) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))));
        console.log("[apple-purchases] Transaction verification:", {
          productId: decoded.productId,
          transactionToken: decoded.appAccountToken ?? "(none)",
          userToken: account.appAccountToken,
          match: decoded.appAccountToken?.toLowerCase() === account.appAccountToken.toLowerCase(),
          originalTransactionId: decoded.originalTransactionId,
          environment: decoded.environment,
        });
      }
    } catch {
      // debug decode non-fatal
    }

    const state = await serverSync(account.appAccountToken, signedTransaction);
    // Finish even a verified expired/refunded transaction, never an unverified one.
    await store.finishTransaction({ purchase, isConsumable: false });
    observers.forEach((notify) => notify());
    return state;
  })();
  processing.set(key, confirmation);
  try { return await confirmation; } finally { processing.delete(key); }
}

async function onPurchase(store: StoreKit, purchase: Purchase, session: number) {
  if (session !== generation) return;
  const attempt = requested?.sku === purchase.productId ? requested : null;
  try {
    const account = await identity();
    if (session !== generation) return;
    if (![account.products.month, account.products.year].includes(purchase.productId)) return;
    if (attempt && attempt.token !== account.appAccountToken) throw new Error("Профилът е сменен по време на покупката.");
    attempt?.onStage?.("verifying");
    const state = await confirmPurchase(store, purchase, account);
    if (attempt) {
      if (!state.appleActive) throw new Error("Няма активен Apple абонамент. Провери покупката в App Store.");
      attempt.resolve(state);
    }
  } catch (error) {
    reportError("[apple-purchases] transaction confirmation failed", error);
    if (attempt) attempt.reject(new Error(
      `${applePurchaseErrorMessage(error)} Не плащай повторно. Използвай „Възстанови покупки“ или поддръжката.`,
      { cause: error },
    ));
  }
}

async function storeKit(): Promise<StoreKit> {
  if (Platform.OS !== "ios") throw new Error("Apple покупки са налични само на iOS.");
  if (!applePurchasesAvailable()) {
    throw new Error("Apple покупки изискват нова iOS сборка (ExpoIap модулът липсва в инсталираното приложение).");
  }
  if (!connection) {
    const session = generation;
    connection = (async () => {
      await closing;
      // Resolve lazily so web, Android and Expo Go never load the native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const store: StoreKit = require("expo-iap");
      if (session !== generation) throw new Error("Apple сесията е прекратена.");
      listeners = [
        store.purchaseUpdatedListener((purchase) => { void onPurchase(store, purchase, session); }),
        store.purchaseErrorListener((error) => {
          if (requested && (!error.productId || error.productId === requested.sku)) requested.reject(
            error.code === store.ErrorCode.Pending || error.code === store.ErrorCode.DeferredPayment ? pendingError() : error,
          );
          else if (!isApplePurchaseCancelled(error)) reportError("[apple-purchases] store error", error);
        }),
      ];
      if (!await store.initConnection()) throw new Error("Не може да се установи връзка с App Store.");
      return store;
    })();
    connection.catch(() => {
      if (session === generation) {
        listeners.forEach((listener) => listener.remove());
        listeners = [];
        connection = null;
      }
    });
  }
  return connection;
}

export function observeApplePurchases(notify: () => void) {
  observers.add(notify);
  return () => { observers.delete(notify); };
}

export function stopApplePurchases() {
  generation++;
  listeners.forEach((listener) => listener.remove());
  listeners = [];
  requested?.reject(new Error("Профилът е сменен. Влез отново за проверка на покупката."));
  requested = null;
  const previous = connection;
  connection = null;
  if (previous) closing = previous.then((store) => store.endConnection()).catch((error: unknown) => {
    reportError("[apple-purchases] disconnect failed", error);
  });
}

export function loadApplePlans() {
  return serial(async () => {
    const store = await storeKit();
    const account = await identity();
    const products = await store.fetchProducts({ skus: [account.products.month, account.products.year], type: "subs" });
    const month = products?.find((product) => product.id === account.products.month);
    const year = products?.find((product) => product.id === account.products.year);
    if (!month || !year) throw new Error("Apple плановете не са налични. Провери App Store или се свържи с поддръжката.");
    return { month, year, ...await serverSync(account.appAccountToken) };
  });
}

async function recoverPending(store: StoreKit, account: Identity) {
  const purchases = await store.getPendingTransactionsIOS();
  for (const purchase of purchases) {
    if ([account.products.month, account.products.year].includes(purchase.productId)) {
      await confirmPurchase(store, purchase, account);
    }
  }
}

export function syncApplePurchases() {
  return serial(async () => {
    const store = await storeKit();
    const account = await identity();
    await recoverPending(store, account);
    return serverSync(account.appAccountToken);
  });
}

export function buyApplePlan(
  plan: Pick<ProductSubscription, "id">,
  onStage?: (stage: ApplePurchaseStage) => void,
) {
  return serial(async () => {
    const store = await storeKit();
    const account = await identity();
    await recoverPending(store, account);
    const before = await serverSync(account.appAccountToken);
    if (!before.canPurchase) throw new Error("Имаш друг активен план или безплатен достъп. Не е започната Apple покупка.");
    if (before.appleActive) {
      const isYearlyUpgrade = before.subscription.interval === "MONTH" && plan.id === account.products.year;
      if (!isYearlyUpgrade) {
        throw new Error("Вече имаш Apple абонамент. Промени плана от „Управлявай в App Store“.");
      }
    }
    if (![account.products.month, account.products.year].includes(plan.id)) throw new Error("Невалиден Apple план.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<State>((resolve, reject) => {
        requested = { sku: plan.id, token: account.appAccountToken, resolve, reject, onStage };
        onStage?.("store");
        timer = setTimeout(() => reject(new Error(
          "Apple още не е потвърдила покупката. Не плащай повторно. Провери чрез „Възстанови покупки“.",
        )), 180_000);
        void store.requestPurchase({
          type: "subs", request: { apple: {
            sku: plan.id, appAccountToken: account.appAccountToken,
            andDangerouslyFinishTransactionAutomatically: false,
          } },
        }).catch(reject);
      });
    } finally {
      clearTimeout(timer);
      requested = null;
    }
  });
}

export function restoreApplePurchases() {
  return serial(async () => {
    const store = await storeKit();
    const account = await identity();
    await store.syncIOS();
    const purchases = await store.getAvailablePurchases({
      alsoPublishToEventListenerIOS: false, onlyIncludeActiveItemsIOS: true,
    });
    for (const purchase of purchases) {
      if ([account.products.month, account.products.year].includes(purchase.productId)) {
        await confirmPurchase(store, purchase, account);
      }
    }
    const state = await serverSync(account.appAccountToken);
    if (!state.appleActive) throw new Error("Няма активна Apple покупка за този профил. Провери Apple ID и профила, с който е купена.");
    return state;
  });
}

export function manageAppleSubscription() {
  return serial(async () => {
    const store = await storeKit();
    const account = await identity();
    await store.showManageSubscriptionsIOS();
    return serverSync(account.appAccountToken);
  });
}

export function isApplePurchaseCancelled(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "user-cancelled";
}

export function applePurchaseErrorMessage(error: unknown) {
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message : "Apple покупката не може да бъде потвърдена. Опитай отново.";
}
