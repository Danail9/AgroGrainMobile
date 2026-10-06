import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api, configureApi, type Session } from "@/api/client";
import { clearCache } from "@/api/queryClient";
import { authResultSchema } from "@/api/schemas";
import { disablePush } from "@/lib/push";
import { z } from "zod";

const SESSION_KEY = "ag.session";

const storedSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
});

async function readStoredSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = storedSessionSchema.safeParse(JSON.parse(raw));
    // A token that is already past its expiry can never work again.
    if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function writeStoredSession(session: Session | null) {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // Keychain unavailable: the session still works until the app closes.
  }
}

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  farmName: string;
  phoneCode: string;
  phone: string;
  role: "FARMER" | "TRADER";
  regionSlug: string;
  settlement: string;
};

type Status = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: Status;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Adopts a session issued by the server (after a password change). */
  adoptSession: (session: Session) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  // A ref, so the API client always reads the live token without re-rendering.
  const sessionRef = useRef<Session | null>(null);

  const setSession = useCallback(async (session: Session | null) => {
    sessionRef.current = session;
    await writeStoredSession(session);
  }, []);

  const endSession = useCallback(async () => {
    await setSession(null);
    await clearCache();
    setStatus("signedOut");
  }, [setSession]);

  useEffect(() => {
    configureApi({
      getSession: () => sessionRef.current,
      setSession,
      onUnauthorized: () => {
        // Revoked, expired or blocked: the server has already ended the session.
        if (sessionRef.current) void endSession();
      },
    });

    let cancelled = false;
    void readStoredSession().then(async (stored) => {
      if (cancelled) return;
      if (stored) {
        sessionRef.current = stored;
        setStatus("signedIn");
      } else {
        // An expired or corrupt entry must not linger in the keychain.
        await writeStoredSession(null);
        setStatus("signedOut");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setSession, endSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api("/auth/login", {
        method: "POST",
        body: { email, password },
        schema: authResultSchema,
        auth: false,
      });
      await clearCache();
      await setSession({ token: result.token, expiresAt: result.expiresAt });
      setStatus("signedIn");
    },
    [setSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await api("/auth/register", {
        method: "POST",
        body: input,
        schema: authResultSchema,
        auth: false,
      });
      await clearCache();
      await setSession({ token: result.token, expiresAt: result.expiresAt });
      setStatus("signedIn");
    },
    [setSession],
  );

  const signOut = useCallback(async () => {
    const token = sessionRef.current?.token;
    // The phone must stop receiving this account's alerts. Needs the live
    // session, so it runs first, but never keeps the user waiting long.
    await Promise.race([
      disablePush().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    // Tell the server in the background; the user should never wait on it.
    if (token) {
      void api("/auth/logout", {
        method: "POST",
        schema: z.object({}).passthrough(),
        token,
      }).catch(() => undefined);
    }
    await endSession();
  }, [endSession]);

  const adoptSession = useCallback(
    async (session: Session) => {
      await setSession(session);
    },
    [setSession],
  );

  const value = useMemo(
    () => ({ status, signIn, register, signOut, adoptSession }),
    [status, signIn, register, signOut, adoptSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
