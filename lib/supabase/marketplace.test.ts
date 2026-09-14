import { describe, expect, it } from "vitest";
import { postExpiryDate } from "./marketplace";

describe("postExpiryDate", () => {
  it("expires an open mic seven days after its date without an opportunity deadline", () => {
    expect(postExpiryDate("open_mic", { event_date: "2026-09-30" })).toBe("2026-10-07");
  });
  it("uses a festival's last day", () => {
    expect(postExpiryDate("event", { event_date: "2026-09-14", event_end_date: "2026-09-16" })).toBe("2026-09-23");
  });
  it("uses a single-day event's start", () => {
    expect(postExpiryDate("event", { event_date: "2026-12-31" })).toBe("2027-01-07");
  });
  it("uses an opportunity's deadline", () => {
    expect(postExpiryDate("opportunity", { open_until: "2026-09-14" })).toBe("2026-09-21");
  });
  it.each([undefined, "", "garbage", "2026-02-30", "2026-13-01"])("rejects invalid date %s without throwing", (event_date) => {
    expect(postExpiryDate("open_mic", { event_date })).toBeNull();
  });
});
