import { describe, expect, it } from "vitest";
import { formatPrice, leiToBani, baniToLei } from "../format";

describe("money formatting (integer bani)", () => {
  it("formats bani as a two-decimal lei string", () => {
    expect(formatPrice(2066)).toBe("20.66 lei");
    expect(formatPrice(165)).toBe("1.65 lei");
    expect(formatPrice(0)).toBe("0.00 lei");
  });

  it("converts a decimal lei form input to exact integer bani", () => {
    expect(leiToBani(4.8)).toBe(480);
    expect(leiToBani(10.82)).toBe(1082);
    expect(leiToBani(5.04)).toBe(504);
  });

  it("round-trips bani -> lei -> bani without drift", () => {
    expect(leiToBani(baniToLei(2066))).toBe(2066);
  });
});
