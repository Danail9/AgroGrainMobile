import * as Sentry from "@sentry/react-native";

import { APP_VERSION } from "@/config";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/** True when crash reporting is configured; without a DSN every call is a no-op. */
export const monitoringEnabled = DSN.length > 0;

if (monitoringEnabled) {
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    release: `agrograin-mobile@${APP_VERSION}`,
    // Errors only, identified by user id; no IP, email or request bodies.
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
  });
}

/** Logs locally and, in configured builds, sends the error to Sentry. */
export function reportError(message: string, error: unknown, context?: Record<string, unknown>) {
  console.error(message, error);
  if (!monitoringEnabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("where", message);
    if (context) scope.setContext("details", context);
    scope.captureException(error instanceof Error ? error : new Error(`${message}: ${String(error)}`));
  });
}

/** Tags later reports with the signed-in account; pass null on sign-out. */
export function identifyUser(user: { id: string; number?: number; role?: string } | null) {
  if (!monitoringEnabled) return;
  const displayId = user ? String(user.number ?? user.id) : null;
  Sentry.setUser(displayId ? { id: displayId } : null);
  Sentry.setTag("user_id", displayId);
  Sentry.setTag("internal_user_id", user?.id ?? null);
  Sentry.setTag("user_number", user?.number ?? null);
  Sentry.setTag("role", user?.role ?? null);
  Sentry.setContext("account", user ? {
    id: user.id,
    number: user.number,
    role: user.role,
    admin_profile_path: user.number ? `/admin/users/${user.number}` : undefined,
  } : null);
}

export const wrapRoot = <P extends Record<string, unknown>>(component: React.ComponentType<P>) =>
  monitoringEnabled ? Sentry.wrap(component) : component;
