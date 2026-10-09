import { useSyncExternalStore } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type DialogAction = {
  label: string;
  style?: "primary" | "cancel" | "destructive";
  onPress?: () => void;
};

export type DialogOptions = {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: "brand" | "danger" | "success";
  actions?: DialogAction[];
  /** Tapping outside or the Android back button closes it, like "cancel". */
  dismissable?: boolean;
};

type Entry = DialogOptions & { id: number };

let queue: Entry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => queue[0] ?? null;

/** Shows a branded dialog. Calls queue up, so a second one waits for the first. */
export function showDialog(options: DialogOptions) {
  queue = [...queue, { ...options, id: nextId++ }];
  emit();
}

/** Resolves true when the user confirms, false when they cancel or dismiss. */
export function confirmDialog(options: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: IconName;
}) {
  return new Promise<boolean>((resolve) => {
    showDialog({
      title: options.title,
      message: options.message,
      icon: options.icon,
      tone: options.destructive ? "danger" : "brand",
      dismissable: true,
      actions: [
        { label: options.cancelLabel ?? "Отказ", style: "cancel", onPress: () => resolve(false) },
        {
          label: options.confirmLabel,
          style: options.destructive ? "destructive" : "primary",
          onPress: () => resolve(true),
        },
      ],
    });
  });
}

function close(entry: Entry, action?: DialogAction) {
  queue = queue.filter((item) => item.id !== entry.id);
  emit();
  action?.onPress?.();
}

/** @internal for tests */
export function resetDialogs() {
  queue = [];
  emit();
}

const TONE = {
  brand: { bg: colors.brand[50], fg: colors.brand[700] },
  success: { bg: colors.brand[50], fg: colors.up },
  danger: { bg: colors.red50, fg: colors.red600 },
} as const;

/** Mounted once at the root; renders the dialog at the head of the queue. */
export function DialogHost() {
  const entry = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!entry) return null;

  const actions = entry.actions?.length ? entry.actions : [{ label: "OK", style: "primary" as const }];
  const cancel = actions.find((action) => action.style === "cancel");
  const tone = TONE[entry.tone ?? "brand"];
  const dismiss = () => {
    if (entry.dismissable || cancel) close(entry, cancel);
  };
  const stacked = actions.length > 2;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Затвори">
        <Pressable style={styles.card} accessibilityRole="alert" onPress={() => undefined}>
          {entry.icon ? (
            <View style={[styles.icon, { backgroundColor: tone.bg }]}>
              <Icon name={entry.icon} size={26} color={tone.fg} />
            </View>
          ) : null}
          <AppText variant="heading" bold style={styles.center}>
            {entry.title}
          </AppText>
          {entry.message ? (
            <AppText tone="muted" style={[styles.center, styles.message]}>
              {entry.message}
            </AppText>
          ) : null}
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {actions.map((action) => {
              const destructive = action.style === "destructive";
              const isCancel = action.style === "cancel";
              const filled = !isCancel;
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={() => close(entry, action)}
                  style={({ pressed }) => [
                    styles.action,
                    !stacked && styles.actionRow,
                    filled
                      ? { backgroundColor: destructive ? colors.red600 : colors.brand[600], borderColor: "transparent" }
                      : { backgroundColor: colors.white, borderColor: colors.line },
                    pressed && pressedStyle,
                  ]}
                >
                  <AppText bold style={{ color: filled ? colors.white : colors.ink, textAlign: "center" }}>
                    {action.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 32, 15, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: space.xl,
    alignItems: "center",
    ...shadowCard,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  center: { textAlign: "center" },
  message: { marginTop: space.sm },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xl, alignSelf: "stretch" },
  actionsStacked: { flexDirection: "column-reverse" },
  action: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  actionRow: { flex: 1 },
});
