import { useEffect } from "react";
import { AppState } from "react-native";
import { z } from "zod";

import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { reportError } from "@/lib/monitoring";

const logged = z.object({ logged: z.boolean() });

export function AppOpenTracker() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "signedIn") return;
    const report = () => {
      void api("/app-open", { method: "POST", schema: logged }).catch((error) => {
        reportError("Recording app open failed", error);
      });
    };
    let previous = AppState.currentState;
    if (previous === "active") report();

    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && previous !== "active") report();
      previous = state;
    });
    return () => listener.remove();
  }, [status]);

  return null;
}
