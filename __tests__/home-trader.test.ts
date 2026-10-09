import { expiringSoon, topMovers } from "@/lib/trade";

const NOW = new Date("2025-10-09T10:00:00Z").getTime();
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

describe("expiringSoon", () => {
  it("keeps active offers ending within 3 days, soonest first", () => {
    const offers = [
      { id: "a", isActive: true, validUntil: inDays(2) },
      { id: "b", isActive: true, validUntil: inDays(0.5) },
      { id: "c", isActive: true, validUntil: inDays(5) },
      { id: "d", isActive: false, validUntil: inDays(1) },
      { id: "e", isActive: true, validUntil: inDays(-1) },
      { id: "f", isActive: true, validUntil: null },
    ];
    expect(expiringSoon(offers, NOW).map((offer) => offer.id)).toEqual(["b", "a"]);
  });
});

describe("topMovers", () => {
  it("returns the biggest absolute moves and skips flat or unknown ones", () => {
    const prices = [
      { slug: "a", changePct: 0.4 },
      { slug: "b", changePct: -2.1 },
      { slug: "c", changePct: 0 },
      { slug: "d", changePct: null },
      { slug: "e", changePct: 1.2 },
      { slug: "f", changePct: 0.1 },
    ];
    expect(topMovers(prices).map((row) => row.slug)).toEqual(["b", "e", "a"]);
    expect(topMovers(undefined)).toEqual([]);
  });
});
