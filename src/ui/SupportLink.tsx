import * as Linking from "expo-linking";

import { SUPPORT_URL } from "@/config";
import { showDialog } from "@/ui/Dialog";
import { SettingsRow } from "@/ui/SettingsList";
import { reportError } from "@/lib/monitoring";

export function SupportLink() {
  async function openSupport() {
    try {
      await Linking.openURL(SUPPORT_URL);
    } catch (error) {
      reportError("Opening support page failed", error);
      showDialog({
        title: "Помощ и поддръжка",
        message: "Страницата не може да се отвори. Опитай отново или пиши на info@agrograinhub.com.",
        icon: "alert-circle-outline",
        dismissable: true,
        actions: [{ label: "Добре", style: "primary" }],
      });
    }
  }

  return (
    <SettingsRow
      first
      icon="help-circle-outline"
      title="Помощ и поддръжка"
      summary="Изпрати проблем или запитване"
      onPress={() => void openSupport()}
    />
  );
}
