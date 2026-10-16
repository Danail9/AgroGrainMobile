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
import { authResultSchema, socialAuthResultSchema } from "@/api/schemas";
import type { SocialCredential } from "@/lib/social-sign-in";
import { disablePush } from "@/lib/push";
import { writeBiometricLock } from "@/lib/biometrics";
import { z } from "zod";
import { identifyUser, reportError } from "@/lib/monitoring";

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

async function clearStoredBiometricLock() {
  try {
    await writeBiometricLock(false);
  } catch (e) {
    reportError("Clearing biometric lock after session ended failed", e);
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

/** What a Google/Apple sign-in still needs before the account can be created. */
export type SocialProfileInput = {
  name: string;
  farmName: string;
  phoneCode: string;
  phone: string;
  role: "FARMER" | "TRADER";
  regionSlug: string;
  settlement: string;
};

export type SocialOutcome =
  | { status: "signedIn" }
  | { status: "needsProfile"; email: string; name: string | null };

type Status = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: Status;
  offerBiometrics: boolean;
  dismissBiometricOffer: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Adopts a session issued by the server (after a password change). */
  adoptSession: (session: Session) => Promise<void>;
  /** Signs in with a Google/Apple token; a new person must finish the profile. */
  socialSignIn: (credential: SocialCredential) => Promise<SocialOutcome>;
  /** Creates the account for the pending Google/Apple sign-in. */
  completeSocialProfile: (profile: SocialProfileInput) => Promise<void>;
  hasPendingSocial: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [offerBiometrics, setOfferBiometrics] = useState(false);
  const dismissBiometricOffer = useCallback(() => setOfferBiometrics(false), []);
  // A ref, so the API client always reads the live token without re-rendering.
  const sessionRef = useRef<Session | null>(null);

  const setSession = useCallback(async (session: Session | null) => {
    sessionRef.current = session;
    await writeStoredSession(session);
  }, []);

  const endSession = useCallback(async () => {
    await setSession(null);
    await clearStoredBiometricLock();
    await clearCache();
    setOfferBiometrics(false);
    identifyUser(null);
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
        await clearStoredBiometricLock();
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
      identifyUser(result.user ?? null);
      setOfferBiometrics(true);
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
      identifyUser(result.user ?? null);
      setOfferBiometrics(true);
      setStatus("signedIn");
    },
    [setSession],
  );

  // Kept in memory only: an identity token must never be written to storage.
  const pendingSocial = useRef<SocialCredential | null>(null);

  const postSocial = useCallback(
    async (body: Record<string, unknown>): Promise<SocialOutcome> => {
      const result = await api("/auth/social", {
        method: "POST",
        body,
        schema: socialAuthResultSchema,
        auth: false,
      });
      if ("needsProfile" in result) {
        return { status: "needsProfile", email: result.email, name: result.name };
      }
      pendingSocial.current = null;
      await clearCache();
      await setSession({ token: result.token, expiresAt: result.expiresAt });
      identifyUser(result.user ?? null);
      setOfferBiometrics(true);
      setStatus("signedIn");
      return { status: "signedIn" };
    },
    [setSession],
  );

  const socialSignIn = useCallback(
    async (credential: SocialCredential) => {
      pendingSocial.current = credential;
      return postSocial({ ...credential });
    },
    [postSocial],
  );

  const completeSocialProfile = useCallback(
    async (profile: SocialProfileInput) => {
      const credential = pendingSocial.current;
      if (!credential) throw new Error("no pending social sign-in");
      const outcome = await postSocial({ ...credential, ...profile });
      if (outcome.status !== "signedIn") throw new Error("profile was not accepted");
    },
    [postSocial],
  );

  const hasPendingSocial = useCallback(() => pendingSocial.current !== null, []);

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
    () => ({
      status,
      offerBiometrics,
      dismissBiometricOffer,
      signIn,
      register,
      signOut,
      adoptSession,
      socialSignIn,
      completeSocialProfile,
      hasPendingSocial,
    }),
    [status, offerBiometrics, dismissBiometricOffer, signIn, register, signOut, adoptSession, socialSignIn, completeSocialProfile, hasPendingSocial],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
