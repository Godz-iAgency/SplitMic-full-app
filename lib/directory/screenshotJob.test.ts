import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Both collaborators mocked: these tests cover the job's own batching,
// resumability, and status bookkeeping — not Firecrawl or Storage.
vi.mock("./screenshots", () => ({ captureScreenshot: vi.fn() }));
vi.mock("@/lib/media/serverUpload", () => ({
  uploadRemoteImage: vi.fn(),
  directoryScreenshotPath: (id: string) => `directory/screenshots/${id}.jpg`,
}));

import { captureScreenshot } from "./screenshots";
import { uploadRemoteImage } from "@/lib/media/serverUpload";
import { backfillScreenshots, SCREENSHOT_BATCH_SIZE } from "./screenshotJob";

const mockCapture = vi.mocked(captureScreenshot);
const mockUpload = vi.mocked(uploadRemoteImage);

const NOW = new Date("2026-08-11T12:00:00Z");

type Row = { id: string; business_name: string; website_url: string | null };

type FakeState = {
  updates: { id: string; payload: Record<string, unknown> }[];
  /** Filters applied to the pending-row select, to prove what it asks for. */
  isFilters: { column: string; value: unknown }[];
  limitUsed: number | null;
};

function fakeSupabase(opts: { pending?: Row[]; selectError?: string } = {}) {
  const state: FakeState = { updates: [], isFilters: [], limitUsed: null };
  const pending = opts.pending ?? [];

  const client = {
    from(_table: string) {
      let pendingUpdate: Record<string, unknown> | null = null;
      let isHeadCount = false;

      const builder: Record<string, unknown> = {
        select: (_cols: string, options?: { head?: boolean }) => {
          isHeadCount = Boolean(options?.head);
          return builder;
        },
        // Stays chainable regardless of how many filters are stacked before
        // the query resolves — the real query builder works the same way
        // (chain filters, only actually run on await/.then()).
        is: (column: string, value: unknown) => {
          state.isFilters.push({ column, value });
          return builder;
        },
        order: () => builder,
        limit: (n: number) => {
          state.limitUsed = n;
          return Promise.resolve({
            data: opts.selectError ? null : pending.slice(0, n),
            error: opts.selectError ? { message: opts.selectError } : null,
          });
        },
        update: (payload: Record<string, unknown>) => {
          pendingUpdate = payload;
          return builder;
        },
        eq: (_col: string, id: string) => {
          if (pendingUpdate) state.updates.push({ id, payload: pendingUpdate });
          return Promise.resolve({ error: null });
        },
        // Reached only by the head-count query (select + is()s, awaited
        // directly with no .limit() in the chain).
        then: (resolve: (value: unknown) => unknown) =>
          resolve(
            isHeadCount
              ? {
                  count: opts.selectError ? null : pending.length,
                  error: opts.selectError ? { message: opts.selectError } : null,
                }
              : { data: [], error: null },
          ),
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

const originalKey = process.env.FIRECRAWL_API_KEY;

beforeEach(() => {
  mockCapture.mockReset();
  mockUpload.mockReset();
  // The job refuses to run without a key, so every test that expects real
  // work needs one present.
  process.env.FIRECRAWL_API_KEY = "test-key";
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = originalKey;
});

describe("backfillScreenshots", () => {
  it("captures, stores, and marks a row done", async () => {
    mockCapture.mockResolvedValue({ ok: true, url: "https://fc.dev/shot.png" });
    mockUpload.mockResolvedValue({
      ok: true,
      publicUrl: "https://supa.co/shot.jpg",
    });
    const { client, state } = fakeSupabase({
      pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://m.com" }],
    });

    const result = await backfillScreenshots(client, { now: NOW });

    expect(result).toMatchObject({ attempted: 1, captured: 1, failed: 0, skipped: 0 });
    expect(state.updates[0].payload).toMatchObject({
      screenshot_status: "done",
      screenshot_url: "https://supa.co/shot.jpg",
    });
  });

  describe("credit safety", () => {
    it("only ever selects rows that were never attempted", async () => {
      // This filter is the whole guarantee that a row is never paid for twice.
      const { client, state } = fakeSupabase({ pending: [] });

      await backfillScreenshots(client, { now: NOW });

      expect(state.isFilters).toContainEqual({
        column: "screenshot_status",
        value: null,
      });
    });

    it("refuses to run at all when the API key is missing, marking nothing", async () => {
      // Regression guard: a missing key once marked every row in the batch as
      // `failed`, which is wrong twice over — nothing was actually attempted,
      // and those rows then sat excluded from later runs.
      delete process.env.FIRECRAWL_API_KEY;
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://m.com" }],
      });

      const result = await backfillScreenshots(client, { now: NOW });

      expect(result.error).toContain("FIRECRAWL_API_KEY is not set");
      expect(state.updates).toEqual([]);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("also skips rows that already have a free Open Graph image (never spend a credit on those)", async () => {
      const { client, state } = fakeSupabase({ pending: [] });

      await backfillScreenshots(client, { now: NOW });

      expect(state.isFilters).toContainEqual({
        column: "og_image_url",
        value: null,
      });
    });

    it("captures nothing on a dry run", async () => {
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://m.com" }],
      });

      const result = await backfillScreenshots(client, { now: NOW, dryRun: true });

      expect(mockCapture).not.toHaveBeenCalled();
      expect(state.updates).toHaveLength(0);
      expect(result).toMatchObject({ dryRun: true, attempted: 1, captured: 0 });
    });

    it("defaults to a small batch", async () => {
      const { client, state } = fakeSupabase({ pending: [] });
      await backfillScreenshots(client, { now: NOW });
      expect(state.limitUsed).toBe(SCREENSHOT_BATCH_SIZE);
    });

    it("honours an explicit smaller batch", async () => {
      const { client, state } = fakeSupabase({ pending: [] });
      await backfillScreenshots(client, { now: NOW, limit: 5 });
      expect(state.limitUsed).toBe(5);
    });
  });

  describe("failure handling", () => {
    it("marks a failed capture rather than retrying it forever", async () => {
      mockCapture.mockResolvedValue({ ok: false, reason: "Screenshot timed out" });
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://m.com" }],
      });

      const result = await backfillScreenshots(client, { now: NOW });

      expect(result.failed).toBe(1);
      expect(state.updates[0].payload).toMatchObject({ screenshot_status: "failed" });
      expect(state.updates[0].payload).not.toHaveProperty("screenshot_url");
      expect(result.failures[0]).toEqual({
        businessName: "Mohawk",
        reason: "Screenshot timed out",
      });
    });

    it("marks failed when the capture works but storing it doesn't", async () => {
      mockCapture.mockResolvedValue({ ok: true, url: "https://fc.dev/shot.png" });
      mockUpload.mockResolvedValue({ ok: false, reason: "Source returned 403" });
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://m.com" }],
      });

      const result = await backfillScreenshots(client, { now: NOW });

      expect(result.failed).toBe(1);
      expect(state.updates[0].payload).toMatchObject({ screenshot_status: "failed" });
    });

    it("skips a listing with no website without spending a credit", async () => {
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "No Site", website_url: null }],
      });

      const result = await backfillScreenshots(client, { now: NOW });

      expect(mockCapture).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: 1, captured: 0, failed: 0 });
      expect(state.updates[0].payload).toMatchObject({ screenshot_status: "skipped" });
    });

    it("keeps going after one row fails", async () => {
      mockCapture
        .mockResolvedValueOnce({ ok: false, reason: "boom" })
        .mockResolvedValueOnce({ ok: true, url: "https://fc.dev/2.png" });
      mockUpload.mockResolvedValue({ ok: true, publicUrl: "https://supa.co/2.jpg" });

      const { client } = fakeSupabase({
        pending: [
          { id: "r1", business_name: "A", website_url: "https://a.com" },
          { id: "r2", business_name: "B", website_url: "https://b.com" },
        ],
      });

      const result = await backfillScreenshots(client, { now: NOW });

      expect(result).toMatchObject({ attempted: 2, captured: 1, failed: 1 });
    });

    it("reports a lookup failure instead of throwing", async () => {
      const { client } = fakeSupabase({ selectError: "connection lost" });

      const result = await backfillScreenshots(client, { now: NOW });

      expect(result.error).toBe("connection lost");
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  it("reports how many rows are still waiting", async () => {
    const { client } = fakeSupabase({
      pending: [
        { id: "r1", business_name: "A", website_url: null },
        { id: "r2", business_name: "B", website_url: null },
      ],
    });

    const result = await backfillScreenshots(client, { now: NOW });

    expect(result.remainingBefore).toBe(2);
  });
});
