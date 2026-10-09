import { useState } from "react";
import { Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import {
  useCreatePriceAlert,
  useDeletePriceAlert,
  usePriceAlerts,
  useUpdatePriceAlert,
} from "@/api/queries";
import { formatNumber, formatShortDate } from "@/lib/format";
import { normalizeDecimal } from "@/lib/forms";
import { colors, space } from "@/theme/tokens";
import { confirmDialog } from "@/ui/Dialog";
import { Button, ChoiceGroup, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Divider, Pill, pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

type Direction = "ABOVE" | "BELOW";

/** Target-price alerts for one crop: set a price, get a push when it is reached. */
export function PriceAlerts({ slug, price, unit }: { slug: string; price: number; unit: string }) {
  const alerts = usePriceAlerts(slug);
  const create = useCreatePriceAlert();
  const update = useUpdatePriceAlert();
  const remove = useDeletePriceAlert();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("ABOVE");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const list = alerts.data?.alerts ?? [];

  function submit() {
    setError(null);
    setSuccess(null);
    const value = Number(normalizeDecimal(target));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Въведи целева цена по-голяма от 0.");
      return;
    }
    const alreadyThere = direction === "ABOVE" ? price >= value : price <= value;
    create.mutate(
      { cropSlug: slug, direction, targetPrice: String(value) },
      {
        onSuccess: () => {
          setTarget("");
          setOpen(false);
          setSuccess(
            alreadyThere
              ? "Алармата е създадена. Цената вече е на целта — ще получиш известие при следващата проверка."
              : "Алармата е създадена. Ще те известим, когато цената стигне целта.",
          );
        },
        onError: (e) => setError(isApiError(e) ? e.message : "Алармата не е създадена. Опитай отново."),
      },
    );
  }

  async function confirmRemove(id: string) {
    const ok = await confirmDialog({
      title: "Да изтрия ли алармата?",
      confirmLabel: "Изтрий",
      destructive: true,
      icon: "trash-outline",
    });
    if (ok) remove.mutate({ id, cropSlug: slug });
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Icon name="flag-outline" size={18} color={colors.brand[600]} />
        <AppText variant="small" bold style={{ flex: 1 }}>
          Ценови аларми
        </AppText>
        {!open ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setOpen(true);
              setSuccess(null);
              if (!target) setTarget(String(Math.round(price)));
            }}
            style={({ pressed }) => pressed && pressedStyle}
          >
            <AppText variant="caption" tone="brand" bold>
              + Нова аларма
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <AppText variant="caption" tone="muted">
        Получи известие, когато цената стигне твоята цел. Сега: {formatNumber(price)} {unit}.
      </AppText>

      <FormMessage error={error} success={success} />

      {open ? (
        <View style={{ gap: space.md }}>
          <ChoiceGroup<Direction>
            label="Извести ме, когато цената е"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "ABOVE", label: "над или равна" },
              { value: "BELOW", label: "под или равна" },
            ]}
          />
          <TextField
            label="Целева цена"
            suffix={unit}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Отказ" variant="secondary" onPress={() => setOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Създай" icon="notifications-outline" loading={create.isPending} onPress={submit} />
            </View>
          </View>
        </View>
      ) : null}

      {list.length ? (
        <View>
          {list.map((alert, index) => (
            <View key={alert.id}>
              {index > 0 ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 10 }}>
                <Icon
                  name={alert.direction === "ABOVE" ? "arrow-up-circle" : "arrow-down-circle"}
                  size={22}
                  color={alert.isActive ? colors.brand[600] : colors.muted}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="small" bold>
                    {alert.direction === "ABOVE" ? "Над" : "Под"} {formatNumber(alert.targetPrice)} {unit}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {alert.isActive
                      ? "Следи се"
                      : alert.triggeredAt
                        ? `Сработи на ${formatShortDate(new Date(alert.triggeredAt))}`
                        : "Спряна"}
                  </AppText>
                </View>
                {alert.isActive ? (
                  <Pill tone="brand">Активна</Pill>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Включи отново"
                    hitSlop={8}
                    disabled={update.isPending}
                    onPress={() => update.mutate({ id: alert.id, isActive: true })}
                    style={({ pressed }) => pressed && pressedStyle}
                  >
                    <AppText variant="caption" tone="brand" bold>
                      Включи отново
                    </AppText>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Изтрий алармата"
                  hitSlop={8}
                  onPress={() => void confirmRemove(alert.id)}
                  style={({ pressed }) => [{ padding: 4 }, pressed && pressedStyle]}
                >
                  <Icon name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : !open && alerts.isSuccess ? (
        <AppText variant="caption" tone="muted">
          Нямаш аларми за тази култура.
        </AppText>
      ) : null}
    </Card>
  );
}
