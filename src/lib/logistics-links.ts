import { Linking } from "react-native";
import { reportError } from "@/lib/monitoring";
import { showDialog } from "@/ui/Dialog";

export async function openLogisticsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid public logistics URL");
    await Linking.openURL(value);
  } catch (error) {
    reportError("Opening Logistics source or navigation failed", error);
    showDialog({ title: "Адресът не може да се отвори", message: "Опитай отново или потърси оператора по посочените контакти.", tone: "danger", icon: "alert-circle-outline" });
  }
}
