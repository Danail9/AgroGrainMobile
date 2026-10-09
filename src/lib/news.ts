/** Splits articles (newest first) into "Днес", "Вчера" and "По-рано". */
export function groupNewsByDay<T extends { publishedAt: string }>(items: readonly T[], now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = today.getTime() - 86_400_000;
  const groups: { title: string; items: T[] }[] = [
    { title: "Днес", items: [] },
    { title: "Вчера", items: [] },
    { title: "По-рано", items: [] },
  ];
  for (const item of items) {
    const at = new Date(item.publishedAt).getTime();
    groups[at >= today.getTime() ? 0 : at >= yesterday ? 1 : 2].items.push(item);
  }
  return groups.filter((group) => group.items.length);
}
