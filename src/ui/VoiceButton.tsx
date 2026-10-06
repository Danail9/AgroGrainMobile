import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { voiceError } from "@/lib/voice";
import { colors, radius } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";

/**
 * Dictation for the chat box. Loaded only in builds that include the native
 * speech module (see `voiceSupported`), so it is a default export for `lazy`.
 */
export default function VoiceButton({
  onText,
  onError,
  disabled,
}: {
  onText: (text: string) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onText(transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    // Stopping on purpose reports "aborted"; that is not a failure.
    if (event.error !== "aborted") onError(voiceError(event.error));
  });

  async function toggle() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    onError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      onError(voiceError("not-allowed"));
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: "bg-BG", interimResults: true, continuous: false });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? "Спри записа" : "Говори"}
      accessibilityState={{ selected: listening }}
      disabled={disabled}
      onPress={() => void toggle()}
      style={({ pressed }) => [
        styles.button,
        listening && { backgroundColor: colors.red600 },
        disabled && { opacity: 0.35 },
        pressed && pressedStyle,
      ]}
    >
      <Icon name={listening ? "stop" : "mic"} size={16} color={listening ? colors.white : colors.brand[700]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
});
