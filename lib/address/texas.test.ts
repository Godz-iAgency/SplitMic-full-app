import { describe, it, expect } from "vitest";
import { isValidTexasZip } from "./texas";

describe("isValidTexasZip", () => {
  it("accepts Austin ZIPs, which were the only ones allowed before", () => {
    // Regression guard: widening the rule must not drop the original members.
    expect(isValidTexasZip("78701")).toBe(true);
    expect(isValidTexasZip("78704")).toBe(true);
    expect(isValidTexasZip("78799")).toBe(true);
  });

  it("accepts the non-Austin Texas cities this change exists to unblock", () => {
    expect(isValidTexasZip("78205")).toBe(true); // San Antonio
    expect(isValidTexasZip("77002")).toBe(true); // Houston
    expect(isValidTexasZip("75201")).toBe(true); // Dallas
    expect(isValidTexasZip("78666")).toBe(true); // San Marcos
  });

  it("accepts El Paso, whose ZIPs sit outside the main Texas block", () => {
    // 885xx is allocated separately from 75000-79999 — a naive single-range
    // check would wrongly reject an entire Texas city.
    expect(isValidTexasZip("79901")).toBe(true); // El Paso, main block
    expect(isValidTexasZip("88510")).toBe(true); // El Paso, 885xx block
    expect(isValidTexasZip("88595")).toBe(true);
  });

  it("rejects out-of-state ZIPs on either side of the Texas block", () => {
    expect(isValidTexasZip("74999")).toBe(false); // Oklahoma side
    expect(isValidTexasZip("80000")).toBe(false); // Colorado side
    expect(isValidTexasZip("87101")).toBe(false); // New Mexico
    expect(isValidTexasZip("90210")).toBe(false); // California
    expect(isValidTexasZip("10001")).toBe(false); // New York
  });

  it("rejects the gap between the two Texas blocks", () => {
    expect(isValidTexasZip("88499")).toBe(false);
    expect(isValidTexasZip("88600")).toBe(false);
  });

  it("rejects anything that isn't exactly five digits", () => {
    expect(isValidTexasZip("7870")).toBe(false);
    expect(isValidTexasZip("787011")).toBe(false);
    expect(isValidTexasZip("78701-1234")).toBe(false);
    expect(isValidTexasZip("abcde")).toBe(false);
    expect(isValidTexasZip("")).toBe(false);
    expect(isValidTexasZip(" 78701")).toBe(false);
  });
});
