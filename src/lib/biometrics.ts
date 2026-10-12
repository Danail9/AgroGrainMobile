import Constants, { ExecutionEnvironment } from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const LOCK_KEY = "ag.biometric-lock";
let pendingWrite: Promise<void> = Promise.resolve();

export async function readBiometricLock(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await pendingWrite;
  const value = await SecureStore.getItemAsync(LOCK_KEY);
  if (value !== null && value !== "1") throw new Error("Invalid biometric lock preference");
  return value === "1";
}

export function writeBiometricLock(enabled: boolean): Promise<void> {
  if (Platform.OS === "web") {
    return enabled ? Promise.reject(new Error("Biometric lock is unavailable on web")) : Promise.resolve();
  }
  const write = pendingWrite.then(() =>
    enabled
      ? SecureStore.setItemAsync(LOCK_KEY, "1")
      : SecureStore.deleteItemAsync(LOCK_KEY),
  );
  // Serialize with logout, but let callers report each failed write.
  pendingWrite = write.then(() => undefined, () => undefined);
  return write;
}

export type BiometricCapability = {
  available: boolean;
  label: string;
  reason?: string;
};

export async function biometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === "web") {
    return { available: false, label: "Биометрия", reason: "Достъпно само в мобилното приложение." };
  }
  if (Platform.OS === "ios" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { available: false, label: "Face ID / Touch ID", reason: "Нужна е инсталирана версия на приложението, не Expo Go." };
  }
  const [hardware, enrolled, types, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  const label = Platform.OS === "ios"
    ? types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? "Face ID" : "Touch ID"
    : "Биометрия";
  if (!hardware) return { available: false, label, reason: "Устройството не поддържа биометрично отключване." };
  if (!enrolled) return { available: false, label, reason: "Настрой Face ID или пръстов отпечатък в настройките на телефона." };
  if (Platform.OS === "android" && level !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
    return { available: false, label, reason: "Нужен е пръстов отпечатък или сигурно 3D разпознаване на лице." };
  }
  return { available: true, label };
}

export function authenticateBiometricLock() {
  return LocalAuthentication.authenticateAsync({
    promptMessage: "Отключи AgroGrain",
    cancelLabel: "Отказ",
    fallbackLabel: "Използвай кода на телефона",
    disableDeviceFallback: false,
    biometricsSecurityLevel: "strong",
  });
}

export function biometricFailure(error: LocalAuthentication.LocalAuthenticationError): string {
  switch (error) {
    case "user_cancel":
    case "app_cancel":
    case "system_cancel":
      return "Отключването е отменено. Опитай отново.";
    case "not_enrolled":
    case "not_available":
    case "passcode_not_set":
      return "Биометрията не е достъпна. Провери настройките на телефона или излез и влез отново в профила.";
    case "lockout":
      return "Биометрията е временно блокирана. Използвай кода на телефона или опитай по-късно.";
    default:
      return "Неуспешно отключване. Опитай отново или излез от профила.";
  }
}
