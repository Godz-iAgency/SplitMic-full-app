import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { importDirectoryBusinesses, IMPORT_BATCH_SIZE } from "./import";
import { DIRECTORY_CSV_HEADERS } from "./csv";

const HEADER = DIRECTORY_CSV_HEADERS.join(",");

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

const MOHAWK = "Venues,Mohawk Austin,book@mohawk.com,https://mohawkaustin.com/,Clubs/Dancehalls/Small Venues";

// ── Fake Supabase client ────────────────────────────────────────────────────
// importDirectoryBusinesses does: one select, then batched inserts, then
// per-row updates. The fake records every write so tests can assert both what
// was written and — just as importantly — what was NOT.

type ExistingSeed = {
  id: string;
  category: string;
  name_key: string;
  business_name?: string | null;
  email?: string | null;
  website_url?: string | null;
  phone?: string | null;
  description?: string | null;
  subcategory?: string | null;
};

type FakeState = {
  inserts: Record<string, unknown>[][];
  updates: { id: string; payload: Record<string, unknown> }[];
};

function fakeSupabase(
  opts: {
    existing?: ExistingSeed[];
    selectError?: string;
    insertError?: string;
    updateError?: string;
  } = {},
) {
  const state: FakeState = { inserts: [], updates: [] };

  const client = {
    from(_table: string) {
      let pendingUpdate: Record<string, unknown> | null = null;

      const builder: Record<string, unknown> = {
        select: () =>
          Promise.resolve({
            data: opts.selectError
              ? null
              : (opts.existing ?? []).map((row) => ({
                  business_name: null,
                  email: null,
                  website_url: null,
                  phone: null,
                  description: null,
                  subcategory: null,
                  ...row,
                })),
            error: opts.selectError ? { message: opts.selectError } : null,
          }),

        insert: (rows: Record<string, unknown>[]) => {
          if (opts.insertError) {
            return Promise.resolve({ error: { message: opts.insertError } });
          }
          state.inserts.push(rows);
          return Promise.resolve({ error: null });
        },

        update: (payload: Record<string, unknown>) => {
          pendingUpdate = payload;
          return builder;
        },

        eq: (_col: string, id: string) => {
          if (opts.updateError) {
            return Promise.resolve({ error: { message: opts.updateError } });
          }
          if (pendingUpdate) state.updates.push({ id, payload: pendingUpdate });
          return Promise.resolve({ error: null });
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

const NOW = new Date("2026-08-09T12:00:00Z");

// ── Tests ───────────────────────────────────────────────────────────────────

describe("importDirectoryBusinesses", () => {
  it("inserts every row into an empty table", async () => {
    const { client, state } = fakeSupabase();

    const result = await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({
      valid: 1,
      toInsert: 1,
      toUpdate: 0,
      unchanged: 0,
      inserted: 1,
      updated: 0,
    });
    expect(state.inserts.flat()).toHaveLength(1);
  });

  it("reports per-category counts", async () => {
    const { client } = fakeSupabase();

    const result = await importDirectoryBusinesses(
      client,
      csv(MOHAWK, "Bands,Amplified Heat,,https://amplifiedheat.bandcamp.com/,Genre: Blues Rock"),
      { now: NOW },
    );

    expect(result.byCategory.venue).toBe(1);
    expect(result.byCategory.band).toBe(1);
    expect(result.byCategory.festival).toBe(0);
  });

  it("leaves an unchanged row alone", async () => {
    const { client, state } = fakeSupabase({
      existing: [
        {
          id: "row-1",
          category: "venue",
          name_key: "mohawk austin",
          business_name: "Mohawk Austin",
          email: "book@mohawk.com",
          website_url: "https://mohawkaustin.com/",
          subcategory: "Clubs & Small Venues",
        },
      ],
    });

    const result = await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

    expect(result).toMatchObject({ toInsert: 0, toUpdate: 0, unchanged: 1 });
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it("updates a row whose scraped data changed", async () => {
    const { client, state } = fakeSupabase({
      existing: [
        {
          id: "row-1",
          category: "venue",
          name_key: "mohawk austin",
          business_name: "Mohawk Austin",
          email: "old@mohawk.com", // changed upstream
          website_url: "https://mohawkaustin.com/",
          subcategory: "Clubs & Small Venues",
        },
      ],
    });

    const result = await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

    expect(result).toMatchObject({ toUpdate: 1, updated: 1, unchanged: 0 });
    expect(state.updates[0].payload.email).toBe("book@mohawk.com");
  });

  describe("curation safety (the re-import must not undo the owner's work)", () => {
    it("never writes tier, outreach, or claim fields when updating", async () => {
      const { client, state } = fakeSupabase({
        existing: [
          {
            id: "row-1",
            category: "venue",
            name_key: "mohawk austin",
            business_name: "Mohawk Austin",
            email: "old@mohawk.com",
            website_url: "https://mohawkaustin.com/",
            subcategory: "Clubs & Small Venues",
          },
        ],
      });

      await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

      const payload = state.updates[0].payload;
      for (const forbidden of [
        "tier",
        "tier_rank",
        "sort_weight",
        "outreach_status",
        "outreach_notes",
        "last_contacted_at",
        "claimed_profile_id",
        "claimed_at",
        "is_active",
      ]) {
        expect(payload).not.toHaveProperty(forbidden);
      }
    });

    it("never writes tier_rank on insert (it is a generated column)", async () => {
      const { client, state } = fakeSupabase();

      await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

      expect(state.inserts.flat()[0]).not.toHaveProperty("tier_rank");
    });

    it("issues no writes at all on a dry run", async () => {
      const { client, state } = fakeSupabase();

      const result = await importDirectoryBusinesses(client, csv(MOHAWK), {
        now: NOW,
        dryRun: true,
      });

      expect(result).toMatchObject({ dryRun: true, toInsert: 1, inserted: 0, updated: 0 });
      expect(state.inserts).toHaveLength(0);
      expect(state.updates).toHaveLength(0);
    });
  });

  describe("dedupe", () => {
    it("counts in-file duplicates without importing them twice", async () => {
      const { client } = fakeSupabase();

      const result = await importDirectoryBusinesses(
        client,
        csv(MOHAWK, MOHAWK.replace("Clubs/Dancehalls/Small Venues", "Auditoriums/Arenas")),
        { now: NOW },
      );

      expect(result.duplicatesInFile).toBe(1);
      expect(result.valid).toBe(1);
      expect(result.inserted).toBe(1);
    });

    it("treats the same name in a different category as a separate business", async () => {
      const { client } = fakeSupabase();

      const result = await importDirectoryBusinesses(
        client,
        csv(
          "Backline Companies,SoundCheck Austin,a@b.com,http://soundcheckaustin.com/,",
          "Rehearsal Studios,SoundCheck Austin,a@b.com,http://soundcheckaustin.com/,",
        ),
        { now: NOW },
      );

      expect(result.duplicatesInFile).toBe(0);
      expect(result.inserted).toBe(2);
    });
  });

  describe("batching", () => {
    it("chunks large inserts", async () => {
      const rows = Array.from(
        { length: IMPORT_BATCH_SIZE + 50 },
        (_, i) => `Venues,Venue Number ${i},,,Clubs/Dancehalls/Small Venues`,
      );
      const { client, state } = fakeSupabase();

      const result = await importDirectoryBusinesses(client, csv(...rows), { now: NOW });

      expect(result.inserted).toBe(IMPORT_BATCH_SIZE + 50);
      expect(state.inserts).toHaveLength(2);
      expect(state.inserts[0]).toHaveLength(IMPORT_BATCH_SIZE);
      expect(state.inserts[1]).toHaveLength(50);
    });
  });

  describe("failures", () => {
    it("reports a bad header instead of importing nothing silently", async () => {
      const { client } = fakeSupabase();
      const result = await importDirectoryBusinesses(client, "Wrong,Header\na,b", {
        now: NOW,
      });
      expect(result.error).toBeTruthy();
      expect(result.inserted).toBe(0);
    });

    it("reports a failed lookup without throwing", async () => {
      const { client, state } = fakeSupabase({ selectError: "connection lost" });

      const result = await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

      expect(result.error).toBe("connection lost");
      expect(state.inserts).toHaveLength(0);
    });

    it("reports a failed insert without claiming success", async () => {
      const { client } = fakeSupabase({ insertError: "permission denied" });

      const result = await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

      expect(result.error).toBe("permission denied");
      expect(result.inserted).toBe(0);
    });

    it("counts rows it did import before an update failed", async () => {
      const { client } = fakeSupabase({
        existing: [
          {
            id: "row-1",
            category: "venue",
            name_key: "mohawk austin",
            business_name: "Stale Name",
          },
        ],
        updateError: "write conflict",
      });

      const result = await importDirectoryBusinesses(client, csv(MOHAWK), { now: NOW });

      expect(result.error).toContain("write conflict");
      expect(result.updated).toBe(0);
      expect(result.toUpdate).toBe(1);
    });

    it("handles an empty CSV as a no-op, not an error", async () => {
      const { client } = fakeSupabase();
      const result = await importDirectoryBusinesses(client, HEADER, { now: NOW });
      expect(result.error).toBeUndefined();
      expect(result.valid).toBe(0);
    });
  });
});
