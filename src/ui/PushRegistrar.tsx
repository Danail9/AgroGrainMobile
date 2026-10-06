import { router } from "expo-router";
import { useEffect } from "react";

import { enablePush, listenForPush } from "@/lib/push";

/**
 * Keeps this phone registered for push while the account wants it, and opens
 * the screen a tapped alert points to. Failures are silent: push is a
 * convenience and must never get in the way of the app.
 */
export function PushRegistrar({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void listenForPush((path) => router.push(path as never))
      .then((cleanup) => {
        if (cancelled) cleanup();
        else stop = cleanup;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (enabled) void enablePush().catch(() => undefined);
  }, [enabled]);

  return null;
}
