import { router } from "expo-router";
import { useEffect } from "react";

import { enablePush, listenForPush } from "@/lib/push";

/**
 * Keeps this phone registered for push while the account wants it, and opens
 * the screen a tapped alert points to. Report failures without blocking use.
 */
export function PushRegistrar({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const controller = new AbortController();
    void listenForPush((path) => router.push(path as never), controller.signal)
      .then((cleanup) => {
        if (cancelled) cleanup();
        else stop = cleanup;
      })
      .catch((error) => console.error("Push notification listener failed", error));
    return () => {
      cancelled = true;
      controller.abort();
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (enabled) void enablePush().catch((error) => console.error("Push notification registration failed", error));
  }, [enabled]);

  return null;
}
