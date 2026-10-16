import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { keys } from "@/api/queries";
import {
  applePurchasesAvailable, observeApplePurchases, stopApplePurchases, syncApplePurchases,
} from "@/lib/apple-purchases";
import { reportError } from "@/lib/monitoring";

export function useAppleBillingSync(userId: string | undefined, role: string | undefined) {
  const client = useQueryClient();
  useEffect(() => {
    if (!userId || role === "ADMIN" || !applePurchasesAvailable()) return;
    let disposed = false;
    let pending = false;
    async function refresh() {
      if (pending || disposed) return;
      pending = true;
      try {
        await syncApplePurchases();
        if (!disposed) await client.invalidateQueries({ queryKey: keys.me });
      } catch (error) {
        // Access stays server-controlled; purchase screens surface verification errors.
        console.warn("[apple-purchases] background verification skipped/failed", error);
      } finally {
        pending = false;
      }
    }
    const unobserve = observeApplePurchases(() => {
      if (!disposed) void Promise.all([
        client.invalidateQueries({ queryKey: keys.me }),
        client.invalidateQueries({ queryKey: ["applePlans"] }),
        client.invalidateQueries({ queryKey: ["plans"] }),
      ]).catch((error: unknown) => reportError("[apple-purchases] refresh failed", error));
    });
    void refresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => { disposed = true; listener.remove(); unobserve(); stopApplePurchases(); };
  }, [client, userId, role]);
}
