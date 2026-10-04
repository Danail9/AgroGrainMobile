import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { colors, radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand[600], fg: colors.white, border: colors.brand[600] },
  secondary: { bg: colors.white, fg: colors.ink, border: colors.line },
  danger: { bg: colors.white, fg: colors.red600, border: "#fecaca" },
  ghost: { bg: "transparent", fg: colors.brand[600], border: "transparent" },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  compact = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  compact?: boolean;
}) {
  const palette = BUTTON[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        inactive && { opacity: 0.55 },
        pressed && pressedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Icon name={icon} size={18} color={palette.fg} />
      ) : null}
      <AppText variant={compact ? "small" : "body"} bold style={{ color: palette.fg }}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  suffix,
  hint,
  ...input
}: TextInputProps & {
  label: string;
  error?: string | null;
  suffix?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <AppText variant="caption" tone="muted" bold style={styles.label}>
        {label}
      </AppText>
      <View
        style={[
          styles.inputWrap,
          focused && { borderColor: colors.brand[500] },
          !!error && { borderColor: colors.down },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[styles.input, input.multiline && styles.inputMultiline]}
        />
        {suffix ? (
          <AppText variant="caption" tone="muted" bold style={{ paddingRight: 14 }}>
            {suffix}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** One-of-N selector shown as pills, for roles, categories and dial codes. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View>
      {label ? (
        <AppText variant="caption" tone="muted" bold style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && pressedStyle,
              ]}
            >
              <AppText
                variant="small"
                bold
                style={{ color: selected ? colors.white : colors.muted }}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Inline form-level error or success line. */
export function FormMessage({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (!error && !success) return null;
  const isError = !!error;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.message,
        { backgroundColor: isError ? colors.red50 : colors.brand[50] },
      ]}
    >
      <AppText variant="small" bold style={{ color: isError ? colors.red600 : colors.brand[700] }}>
        {error ?? success}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
  },
  buttonCompact: { minHeight: 38, borderRadius: radius.md, paddingHorizontal: space.md },
  label: { marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: "top" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  choiceSelected: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  message: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
});
