import type { z } from "zod";
import { View } from "react-native";

import type { briefingSectionSchema } from "@/api/schemas";
import { space } from "@/theme/tokens";
import { SECTION_STYLE } from "@/lib/icons";
import { Icon } from "@/ui/Icon";
import { Divider, IconTile, RowList, tileColor } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type BriefingSection = z.infer<typeof briefingSectionSchema>;

/** The section list on its own, so the home screen can preview a few of them. */
export function BriefingSections({ sections }: { sections: BriefingSection[] }) {
  return (
    <RowList>
      {sections.map((section, index) => {
        const style = SECTION_STYLE[section.icon] ?? SECTION_STYLE.tip;
        return (
          <View key={`${section.title}-${index}`}>
            {index > 0 ? <Divider /> : null}
            <View style={{ flexDirection: "row", gap: space.md, padding: space.lg }}>
              <IconTile tone={style.tone} size="sm">
                <Icon name={style.icon} size={16} color={tileColor(style.tone)} />
              </IconTile>
              <View style={{ flex: 1 }}>
                <AppText variant="small" bold>
                  {section.title}
                </AppText>
                <AppText
                  variant="caption"
                  tone="muted"
                  style={{ marginTop: 4, lineHeight: 17, fontSize: 12 }}
                >
                  {section.body}
                </AppText>
              </View>
            </View>
          </View>
        );
      })}
    </RowList>
  );
}

