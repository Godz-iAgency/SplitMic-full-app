import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./places", () => ({
  findPlace: vi.fn(),
  resolvePhotoUrl: vi.fn(),
}));

import { findPlace, resolvePhotoUrl } from "./places";
import { backfillPlacePhotos, PLACES_BATCH_SIZE } from "./placesJob";

const mockFind = vi.mocked(findPlace);
const mockResolve = vi.mocked(resolvePhotoUrl);

const NOW = new Date("2026-08-11T12:00:00Z");

type FakeState = {
  updates: { id: string; payload: Record<string, unknown> }[];
  isFilters: { column: string; value: unknown }[];
  limitUsed: number | null;
};

function fakeSupabase(
  opts: { pending?: { id: string; business_name: string }[]; selectError?: string } = {},
) {
  const state: FakeState = { updates: [], isFilters: [], limitUsed: null };
  const pending = opts.pending ?? [];

  const client = {
    from(_table: string) {
      let update: Record<string, unknown> | null = null;
      let headCount = false;

      const builder: Record<string, unknown> = {
        select: (_c: string, o?: { head?: boolean }) => {
          headCount = Boolean(o?.head);
          return builder;
        },
        is: (column: string, value: unknown) => {
          state.isFilters.push({ column, value });
          if (headCount) {
            return Promise.resolve({
              count: opts.selectError ? null : pending.length,
              error: opts.selectError ? { message: opts.selectError } : null,
            });
          }
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
          update = payload;
          return builder;
        },
        eq: (_c: string, id: string) => {
          if (update) state.updates.push({ id, payload: update });
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

const ONE = [{ id: "r1", business_name: "04 Center" }];

beforeEach(() => {
  mockFind.mockReset();
  mockResolve.mockReset();
});

describe("backfillPlacePhotos", () => {
  it("stores the photo when a place matches", async () => {
    mockFind.mockResolvedValue({
      ok: true,
      data: { placeId: "ChIJ123", photoName: "places/ChIJ123/photos/abc" },
    });
    mockResolve.mockResolvedValue({ ok: true, data: "https://lh3.googleusercontent.com/x" });
    const { client, state } = fakeSupabase({ pending: ONE });

    const result = await backfillPlacePhotos(client, { now: NOW });

    expect(result).toMatchObject({ attempted: 1, photos: 1, failed: 0 });
    expect(state.updates[0].payload).toMatchObject({
      places_status: "done",
      place_id: "ChIJ123",
      place_photo_name: "places/ChIJ123/photos/abc",
      place_photo_url: "https://lh3.googleusercontent.com/x",
    });
  });

  describe("cost safety", () => {
    it("only selects rows never looked up", async () => {
      // The guarantee that a billed lookup never repeats.
      const { client, state } = fakeSupabase({ pending: [] });
      await backfillPlacePhotos(client, { now: NOW });
      expect(state.isFilters).toContainEqual({ column: "places_status", value: null });
    });

    it("calls nothing on a dry run", async () => {
      const { client, state } = fakeSupabase({ pending: ONE });

      const result = await backfillPlacePhotos(client, { now: NOW, dryRun: true });

      expect(mockFind).not.toHaveBeenCalled();
      expect(state.updates).toHaveLength(0);
      expect(result).toMatchObject({ dryRun: true, attempted: 1, photos: 0 });
    });

    it("defaults to a small batch", async () => {
      const { client, state } = fakeSupabase({ pending: [] });
      await backfillPlacePhotos(client, { now: NOW });
      expect(state.limitUsed).toBe(PLACES_BATCH_SIZE);
    });

    it("does not try to resolve a photo when the place has none", async () => {
      mockFind.mockResolvedValue({
        ok: true,
        data: { placeId: "ChIJ123", photoName: null },
      });
      const { client, state } = fakeSupabase({ pending: ONE });

      const result = await backfillPlacePhotos(client, { now: NOW });

      expect(mockResolve).not.toHaveBeenCalled();
      expect(result.noPhoto).toBe(1);
      expect(state.updates[0].payload).toMatchObject({ places_status: "no_photo" });
    });
  });

  describe("outcomes", () => {
    it("records not_found so the name is never retried", async () => {
      mockFind.mockResolvedValue({ ok: true, data: null });
      const { client, state } = fakeSupabase({ pending: ONE });

      const result = await backfillPlacePhotos(client, { now: NOW });

      expect(result.notFound).toBe(1);
      expect(state.updates[0].payload).toMatchObject({ places_status: "not_found" });
      expect(state.updates[0].payload).not.toHaveProperty("place_photo_url");
    });

    it("keeps the matched place when only the photo fetch fails", async () => {
      mockFind.mockResolvedValue({
        ok: true,
        data: { placeId: "ChIJ123", photoName: "places/ChIJ123/photos/abc" },
      });
      mockResolve.mockResolvedValue({ ok: false, reason: "Photo returned 403" });
      const { client, state } = fakeSupabase({ pending: ONE });

      const result = await backfillPlacePhotos(client, { now: NOW });

      expect(result.failed).toBe(1);
      // A retry can re-resolve from the stored name without paying for the
      // place search again.
      expect(state.updates[0].payload).toMatchObject({
        places_status: "failed",
        place_id: "ChIJ123",
        place_photo_name: "places/ChIJ123/photos/abc",
      });
    });

    it("keeps going after one row fails", async () => {
      mockFind
        .mockResolvedValueOnce({ ok: false, reason: "boom" })
        .mockResolvedValueOnce({
          ok: true,
          data: { placeId: "p2", photoName: "places/p2/photos/x" },
        });
      mockResolve.mockResolvedValue({ ok: true, data: "https://lh3.googleusercontent.com/2" });

      const { client } = fakeSupabase({
        pending: [
          { id: "r1", business_name: "A" },
          { id: "r2", business_name: "B" },
        ],
      });

      const result = await backfillPlacePhotos(client, { now: NOW });

      expect(result).toMatchObject({ attempted: 2, photos: 1, failed: 1 });
    });

    it("reports a lookup failure instead of throwing", async () => {
      const { client } = fakeSupabase({ selectError: "connection lost" });

      const result = await backfillPlacePhotos(client, { now: NOW });

      expect(result.error).toBe("connection lost");
      expect(mockFind).not.toHaveBeenCalled();
    });
  });
});
