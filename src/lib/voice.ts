import Constants, { ExecutionEnvironment } from "expo-constants";

/** The speech module is native code, so Expo Go cannot load it. */
export const voiceSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const ERRORS: Record<string, string> = {
  "not-allowed": "Няма достъп до микрофона. Разреши го от настройките на телефона.",
  "service-not-allowed": "Няма достъп до микрофона. Разреши го от настройките на телефона.",
  "no-speech": "Не чух нищо. Опитай отново и говори по-близо до микрофона.",
  "audio-capture": "Не откривам микрофон на това устройство.",
  network: "Няма връзка с услугата за разпознаване на глас.",
};

/** Bulgarian wording for a speech-recognition error code, as on the web. */
export function voiceError(code: string) {
  return ERRORS[code] ?? "Гласовото въвеждане не е налично в момента.";
}
