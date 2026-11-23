import { useRef, useState } from "react";
import { Modal, View } from "react-native";
import { isApiError } from "@/api/client";
import { useUpdatePrefs } from "@/api/queries";
import { colors, radius, space } from "@/theme/tokens";
import { Button, FormMessage } from "@/ui/forms";
import { AppText } from "@/ui/Text";

export function NewsNotificationWelcome() {
  const update = useUpdatePrefs();
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  function choose(news: boolean) {
    if (saving.current) return;
    saving.current = true;
    setError(null);
    update.mutate({ news, newsPromptPending: false }, {
      onError: (cause) => setError(isApiError(cause) ? cause.message : "Не успяхме да запазим избора. Опитай отново."),
      onSettled: () => { saving.current = false; },
    });
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => undefined}>
      <View style={{ flex: 1, justifyContent: "center", padding: space.xl, backgroundColor: "rgba(0,0,0,0.45)" }}>
        <View accessibilityViewIsModal style={{ padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.white, gap: space.lg }}>
          <AppText variant="heading" accessibilityRole="header">Известия за агро новини</AppText>
          <AppText>
            Известията за нови публикации, седмичния обзор и доклада на USDA са включени по подразбиране.
            Можеш да ги спреш сега или по всяко време от Профил → Известия.
          </AppText>
          <AppText variant="small" tone="muted">
            За известия на телефона е необходимо и разрешение от устройството. Другите видове известия имат отделни настройки.
          </AppText>
          <FormMessage error={error} />
          <Button title="Остави включени" loading={update.isPending} onPress={() => choose(true)} />
          <Button title="Спри известията за новини" variant="ghost" disabled={update.isPending} onPress={() => choose(false)} />
        </View>
      </View>
    </Modal>
  );
}
