export function insightSourceName(name: string): string {
  return name.replace(/^@/, "").toLowerCase() === "jlinvillefert" ? "Josh Linville" : name;
}

export function isXSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
export function hasInsightTranslation(item: { translation: string | null }): boolean {
  return !!item.translation?.trim();
}
export function insightTranslationPreview(translation: string) {
  const text = translation.trim();
  if (text.length <= 320) return { text, shortened: false };
  const excerpt = text.slice(0, 319);
  const lastSpace = excerpt.search(/\s+\S*$/u);
  return { text: `${excerpt.slice(0, lastSpace > 0 ? lastSpace : 319).trimEnd()}…`, shortened: true };
}
