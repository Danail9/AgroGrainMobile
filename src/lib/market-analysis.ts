import type { PriceRow } from "@/api/schemas";

export function compareCropPorts(crop: PriceRow) {
  const varna = crop.portPrices?.find((price) => price.destination === "VARNA");
  const burgas = crop.portPrices?.find((price) => price.destination === "BURGAS");
  if (!varna || !burgas) return { varna, burgas, difference: null, percent: null, sameDate: false };
  const sameDate = varna.date.slice(0, 10) === burgas.date.slice(0, 10);
  const difference = sameDate ? burgas.price - varna.price : null;
  return { varna, burgas, difference, percent: difference === null ? null : difference / varna.price * 100, sameDate };
}

export function cropNewsTerms(name: string) {
  const roots = ["пшениц", "слънчоглед", "царевиц", "ечемик", "рапиц", "нахут", "соя", "сорго", "овес", "ръж", "люцерн"];
  const lower = name.toLocaleLowerCase("bg");
  return roots.filter((term) => lower.includes(term));
}
