import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { api } from "@/api/client";

const logged = z.object({}).passthrough();

/**
 * Reports each screen the user opens, as the portal's tracker does for web
 * pages, so admin statistics include phone users. Fire-and-forget: a failed
 * or offline report is dropped and must never disturb the screen.
 */
export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    void api("/activity", { method: "POST", body: { path: pathname }, schema: logged }).catch(
      () => undefined,
    );
  }, [pathname]);

  return null;
}
