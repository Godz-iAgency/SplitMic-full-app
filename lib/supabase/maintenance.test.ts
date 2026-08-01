import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanupExpiredPosts,
  cutoffDate,
  CLEANUP_BATCH_SIZE,
  DEFAULT_RETENTION_DAYS,
} from "./maintenance";

// ── Fake Supabase client ────────────────────────────────────────────────────
// cleanupExpiredPosts issues: a select on marketplace_posts, two head-counts on
// the cascade children, then a delete. The fake records what it was asked to do
// so the tests can assert the delete happened (or didn't).

type FakeState = {
  postIds: string[];
  eventTagCount: number;
  openMicCount: number;
  selectError?: string;
  deleteError?: string;
  /** Ids the code actually asked to delete. Empty when no delete was issued. */
  deleted: string[];
  /** Value passed to .lt("expires_at", ...) — the cutoff under test. */
  cutoffUsed: string | null;
  /** Value passed to .limit(...) on the post select. */
  limitUsed: number | null;
};

function fakeSupabase(
  overrides: Partial<
    Pick<
      FakeState,
      "postIds" | "eventTagCount" | "openMicCount" | "selectError" | "deleteError"
    >
  > = {},
) {
  const state: FakeState = {
    postIds: [],
    eventTagCount: 0,
    openMicCount: 0,
    deleted: [],
    cutoffUsed: null,
    limitUsed: null,
    ...overrides,
  };

  const client = {
    from(table: string) {
      let isDelete = false;

      const builder: Record<string, unknown> = {
        select: () => builder,
        delete: () => {
          isDelete = true;
          return builder;
        },
        lt: (_col: string, value: string) => {
          state.cutoffUsed = value;
          return builder;
        },
        limit: (n: number) => {
          state.limitUsed = n;
          return builder;
        },
        in: (_col: string, values: string[]) => {
          if (isDelete) state.deleted = [...values];
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (isDelete) {
            return resolve({
              error: state.deleteError ? { message: state.deleteError } : null,
            });
          }
          if (table === "marketplace_posts") {
            return resolve({
              data: state.selectError
                ? null
                : state.postIds.map((id) => ({ id })),
              error: state.selectError ? { message: state.selectError } : null,
            });
          }
          if (table === "event_band_tags") {
            return resolve({ count: state.eventTagCount });
          }
          if (table === "open_mic_signups") {
            return resolve({ count: state.openMicCount });
          }
          return resolve({ data: [], error: null });
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

const NOW = new Date("2026-08-01T12:00:00Z");

// ── Tests ───────────────────────────────────────────────────────────────────

describe("cutoffDate", () => {
  it("subtracts the retention window and returns a plain date", () => {
    expect(cutoffDate(365, NOW)).toBe("2025-08-01");
  });

  it("handles a leap day without drifting", () => {
    expect(cutoffDate(1, new Date("2028-03-01T00:00:00Z"))).toBe("2028-02-29");
  });

  it("ignores the time of day, since expires_at is a date", () => {
    expect(cutoffDate(30, new Date("2026-08-01T23:59:59Z"))).toBe(
      cutoffDate(30, new Date("2026-08-01T00:00:00Z")),
    );
  });
});

describe("cleanupExpiredPosts", () => {
  it("deletes posts past the retention window", async () => {
    const { client, state } = fakeSupabase({
      postIds: ["old-1", "old-2"],
      eventTagCount: 3,
      openMicCount: 7,
    });

    const result = await cleanupExpiredPosts(client, { now: NOW });

    expect(state.deleted).toEqual(["old-1", "old-2"]);
    expect(result).toMatchObject({
      cutoffDate: "2025-08-01",
      postsDeleted: 2,
      eventTagsRemoved: 3,
      openMicSignupsRemoved: 7,
      dryRun: false,
      moreRemaining: false,
    });
  });

  it("defaults to a one-year window", async () => {
    const { client, state } = fakeSupabase({ postIds: ["a"] });

    await cleanupExpiredPosts(client, { now: NOW });

    expect(DEFAULT_RETENTION_DAYS).toBe(365);
    expect(state.cutoffUsed).toBe("2025-08-01");
  });

  it("does nothing when no post is old enough", async () => {
    const { client, state } = fakeSupabase({ postIds: [] });

    const result = await cleanupExpiredPosts(client, { now: NOW });

    expect(state.deleted).toEqual([]);
    expect(result.postsDeleted).toBe(0);
    expect(result.error).toBeUndefined();
  });

  describe("the retention floor", () => {
    // A post soft-expires 7 days after the event, and its open mic roster and
    // band accept/decline records cascade with it. A short window here would
    // silently destroy history that is still current.
    it("refuses a window short enough to delete live history", async () => {
      const { client, state } = fakeSupabase({ postIds: ["recent"] });

      const result = await cleanupExpiredPosts(client, {
        retentionDays: 7,
        now: NOW,
      });

      expect(state.deleted).toEqual([]);
      expect(result.postsDeleted).toBe(0);
      expect(result.error).toContain("at least 30 days");
    });

    it("refuses zero and negative windows", async () => {
      for (const retentionDays of [0, -1, -365]) {
        const { client, state } = fakeSupabase({ postIds: ["a"] });
        const result = await cleanupExpiredPosts(client, {
          retentionDays,
          now: NOW,
        });
        expect(state.deleted).toEqual([]);
        expect(result.error).toBeTruthy();
      }
    });

    it("refuses a non-numeric window rather than treating it as zero", async () => {
      const { client, state } = fakeSupabase({ postIds: ["a"] });

      const result = await cleanupExpiredPosts(client, {
        retentionDays: Number.NaN,
        now: NOW,
      });

      expect(state.deleted).toEqual([]);
      expect(result.error).toBeTruthy();
    });

    it("allows a longer window than the default", async () => {
      const { client, state } = fakeSupabase({ postIds: ["ancient"] });

      const result = await cleanupExpiredPosts(client, {
        retentionDays: 730,
        now: NOW,
      });

      expect(result.error).toBeUndefined();
      expect(state.cutoffUsed).toBe("2024-08-01"); // exactly 2 non-leap years back
      expect(state.deleted).toEqual(["ancient"]);
    });
  });

  describe("dry run", () => {
    it("reports the blast radius without deleting anything", async () => {
      const { client, state } = fakeSupabase({
        postIds: ["old-1", "old-2"],
        eventTagCount: 4,
        openMicCount: 11,
      });

      const result = await cleanupExpiredPosts(client, {
        dryRun: true,
        now: NOW,
      });

      expect(state.deleted).toEqual([]);
      expect(result).toMatchObject({
        postsDeleted: 2,
        eventTagsRemoved: 4,
        openMicSignupsRemoved: 11,
        dryRun: true,
      });
    });
  });

  describe("batching", () => {
    it("caps how many posts one run touches", async () => {
      const { client, state } = fakeSupabase({ postIds: ["a"] });

      await cleanupExpiredPosts(client, { now: NOW });

      expect(state.limitUsed).toBe(CLEANUP_BATCH_SIZE);
    });

    it("flags that more remain when the batch fills up", async () => {
      const full = Array.from({ length: CLEANUP_BATCH_SIZE }, (_, i) => `p${i}`);
      const { client } = fakeSupabase({ postIds: full });

      const result = await cleanupExpiredPosts(client, { now: NOW });

      expect(result.moreRemaining).toBe(true);
    });

    it("does not flag more when the batch is short", async () => {
      const { client } = fakeSupabase({ postIds: ["a", "b"] });

      const result = await cleanupExpiredPosts(client, { now: NOW });

      expect(result.moreRemaining).toBe(false);
    });
  });

  describe("database failures", () => {
    it("reports a failed lookup instead of throwing", async () => {
      const { client, state } = fakeSupabase({ selectError: "connection lost" });

      const result = await cleanupExpiredPosts(client, { now: NOW });

      expect(state.deleted).toEqual([]);
      expect(result.error).toBe("connection lost");
      expect(result.postsDeleted).toBe(0);
    });

    it("reports a failed delete without claiming success", async () => {
      const { client } = fakeSupabase({
        postIds: ["a", "b"],
        deleteError: "permission denied",
      });

      const result = await cleanupExpiredPosts(client, { now: NOW });

      expect(result.error).toBe("permission denied");
      expect(result.postsDeleted).toBe(0);
    });
  });
});
