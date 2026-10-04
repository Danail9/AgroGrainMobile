import { Children, Fragment, type ReactNode } from "react";
import { View } from "react-native";

import { colors, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { Divider, RowList } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

/** A label/value line with an icon, as in the portal's detail screens. */
export function DetailRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: space.md,
      }}
    >
      <Icon name={icon} size={17} color={colors.brand[600]} />
      <AppText variant="small" tone="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="small" bold style={{ textAlign: "right", flexShrink: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

/** A card of rows with a hairline between them, and none above the first. */
export function DetailList({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <RowList>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          {row}
        </Fragment>
      ))}
    </RowList>
  );
}
