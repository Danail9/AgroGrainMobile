import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import {
  authenticateBiometricLock, biometricCapability, biometricFailure,
  readBiometricLock, writeBiometricLock, type BiometricCapability,
} from "@/lib/biometrics";
import { reportError } from "@/lib/monitoring";

type BiometricContextValue = {
  enabled: boolean;
  ready: boolean;
  locked: boolean;
  busy: boolean;
  error: string | null;
  capability: BiometricCapability | null;
  reload: () => Promise<void>;
  unlock: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

const BiometricContext = createContext<BiometricContextValue | null>(null);

export function BiometricProvider({ children }: { children: ReactNode }) {
  const { status, dismissBiometricOffer } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [foregroundVersion, setForegroundVersion] = useState(0);
  const autoAttempted = useRef(false);
  const enabledRef = useRef(false);
  const statusRef = useRef(status);
  const request = useRef(false);
  const epoch = useRef(0);
  const loadEpoch = useRef(0);
  const foreground = useRef(AppState.currentState);

  const reload = useCallback(async () => {
    if (statusRef.current !== "signedIn") return;
    const id = ++loadEpoch.current;
    await Promise.resolve();
    if (id !== loadEpoch.current || statusRef.current !== "signedIn") return;
    setReady(false);
    setError(null);
    try {
      const stored = await readBiometricLock();
      if (id !== loadEpoch.current || statusRef.current !== "signedIn") return;
      enabledRef.current = stored;
      setEnabledState(stored);
      setLocked(stored);
      setReady(true);
      // Unavailable hardware must never disable a previously enabled lock.
      const available = await biometricCapability();
      if (id === loadEpoch.current && statusRef.current === "signedIn") setCapability(available);
    } catch (e) {
      if (id !== loadEpoch.current || statusRef.current !== "signedIn") return;
      reportError("Biometric lock initialization failed", e);
      setError("Не успяхме да проверим настройките за отключване. Опитай отново.");
    }
  }, []);

  useEffect(() => {
    statusRef.current = status;
    epoch.current++;
    loadEpoch.current++;
    if (status === "signedIn") {
      void Promise.resolve().then(reload);
    }
    const requestEpoch = epoch;
    const initializationEpoch = loadEpoch;
    return () => {
      statusRef.current = "loading";
      requestEpoch.current++;
      initializationEpoch.current++;
    };
  }, [status, reload]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      foreground.current = state;
      if (state === "active") setForegroundVersion((value) => value + 1);
      if (state === "background") epoch.current++;
      // Face ID itself can make iOS inactive; do not invalidate its own prompt.
      if (enabledRef.current && (state === "background" || (state === "inactive" && !request.current))) {
        autoAttempted.current = false;
        setLocked(true);
        setError(null);
      }
    });
    return () => subscription.remove();
  }, []);

  const authenticate = useCallback(async (nextEnabled?: boolean) => {
    if (request.current || statusRef.current !== "signedIn" || foreground.current !== "active") return;
    request.current = true;
    const id = epoch.current;
    setBusy(true);
    setError(null);
    try {
      if (nextEnabled === true) {
        const available = await biometricCapability();
        setCapability(available);
        if (!available.available) {
          setError(available.reason ?? "Биометрията не е достъпна.");
          return;
        }
      }
      if (id !== epoch.current || statusRef.current !== "signedIn") return;
      const result = await authenticateBiometricLock();
      if (id !== epoch.current || statusRef.current !== "signedIn") {
        if (statusRef.current === "signedIn") setError("Приложението беше затворено. Отключи отново.");
        return;
      }
      if (!result.success) {
        setError(biometricFailure(result.error));
        return;
      }
      if (nextEnabled !== undefined) {
        await writeBiometricLock(nextEnabled);
        if (statusRef.current !== "signedIn") return;
        enabledRef.current = nextEnabled;
        setEnabledState(nextEnabled);
        if (nextEnabled) dismissBiometricOffer();
      }
      setLocked(enabledRef.current && id !== epoch.current);
    } catch (e) {
      if (statusRef.current === "signedIn") {
        reportError("Biometric lock operation failed", e);
        setError("Неуспешна проверка или запис. Опитай отново.");
      }
    } finally {
      request.current = false;
      setBusy(false);
    }
  }, [dismissBiometricOffer]);

  const unlock = useCallback(() => authenticate(), [authenticate]);
  const setEnabled = useCallback((next: boolean) => authenticate(next), [authenticate]);
  useEffect(() => {
    if (
      status !== "signedIn" || !ready || !enabled || !locked || busy || error ||
      foreground.current !== "active" || autoAttempted.current
    ) return;
    autoAttempted.current = true;
    void Promise.resolve().then(unlock);
  }, [status, ready, enabled, locked, busy, error, foregroundVersion, unlock]);

  const value = useMemo(() => ({
    enabled, ready, locked, busy, error, capability, reload, unlock, setEnabled,
  }), [enabled, ready, locked, busy, error, capability, reload, unlock, setEnabled]);

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>;
}

export function useBiometricLock() {
  const value = useContext(BiometricContext);
  if (!value) throw new Error("useBiometricLock must be used inside <BiometricProvider>");
  return value;
}
