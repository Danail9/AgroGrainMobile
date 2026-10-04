import { normalizeDecimal, validUntil } from "@/lib/forms";

describe("normalizeDecimal", () => {
  it("turns the Bulgarian decimal comma into a point", () => {
    expect(normalizeDecimal("1,5")).toBe("1.5");
    expect(normalizeDecimal(" 198,50 ")).toBe("198.50");
  });

  it("leaves a point and plain integers alone", () => {
    expect(normalizeDecimal("1.5")).toBe("1.5");
    expect(normalizeDecimal("200")).toBe("200");
    expect(normalizeDecimal("")).toBe("");
  });
});

describe("validUntil", () => {
  const evening = new Date(2026, 9, 4, 23, 30); // 4 Oct, 23:30 local

  it("is empty for no expiry", () => {
    expect(validUntil("none", evening)).toBe("");
  });

  it("counts calendar days in local time, even late in the evening", () => {
    expect(validUntil("7", evening)).toBe("2026-10-11");
    expect(validUntil("30", evening)).toBe("2026-11-03");
  });

  it("rolls over month and year ends", () => {
    expect(validUntil("90", new Date(2026, 11, 15))).toBe("2027-03-15");
    expect(validUntil("7", new Date(2026, 11, 28))).toBe("2027-01-04");
  });
});
