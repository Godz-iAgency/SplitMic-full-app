import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadProfileMedia } from "./upload";

vi.mock("./compress", () => ({ compressImage: async (file: File) => file }));
vi.mock("./validate", () => ({ validateMedia: async () => null, getVideoDuration: async () => 1 }));

afterEach(() => vi.unstubAllGlobals());

function setup(failure?: "upload" | "save", existing = true) {
  // Image dimensions are optional; no DOM, network, or real storage is used.
  vi.stubGlobal("Image", class { constructor() { throw new Error("No DOM"); } });
  const operations: string[] = [];
  const remove = vi.fn(async (paths: string[]) => { operations.push(`remove:${paths[0]}`); return { error: null }; });
  const bucket = {
    upload: vi.fn(async () => { operations.push("upload"); return { error: failure === "upload" ? { message: "offline" } : null }; }),
    remove,
    getPublicUrl: () => ({ data: { publicUrl: "https://example.com/new.jpg" } }),
  };
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query),
    maybeSingle: async () => ({ data: existing ? { id: "media", storage_path: "old.jpg", poster_path: null } : null, error: null }),
    update: vi.fn(() => { operations.push("save"); return query; }),
    insert: vi.fn(() => { operations.push("save"); return query; }),
    delete: vi.fn(() => { operations.push("delete"); return query; }),
    single: async () => ({ data: failure === "save" ? null : { id: "media" }, error: failure === "save" ? { message: "save failed" } : null }),
  };
  const client = { from: () => query, storage: { from: () => bucket } } as unknown as SupabaseClient;
  return { client, query, bucket, operations };
}

const params = () => ({ file: new File(["image"], "new.jpg", { type: "image/jpeg" }), kind: "avatar" as const, userId: "user", profileId: "profile" });

describe("profile media replacement", () => {
  it("retains the existing photo when uploading fails", async () => {
    const s = setup("upload");
    expect((await uploadProfileMedia(s.client, params())).ok).toBe(false);
    expect(s.bucket.remove).not.toHaveBeenCalled();
    expect(s.query.delete).not.toHaveBeenCalled();
    expect(s.query.update).not.toHaveBeenCalled();
  });
  it("rolls back only the new object when saving fails", async () => {
    const s = setup("save");
    expect((await uploadProfileMedia(s.client, params())).ok).toBe(false);
    expect(s.bucket.remove).toHaveBeenCalledTimes(1);
    expect(s.bucket.remove.mock.calls[0][0]).not.toContain("old.jpg");
    expect(s.query.delete).not.toHaveBeenCalled();
  });
  it("removes the old object only after the replacement is saved", async () => {
    const s = setup();
    expect((await uploadProfileMedia(s.client, params())).ok).toBe(true);
    expect(s.operations).toEqual(["upload", "save", "remove:old.jpg"]);
    expect(s.query.eq).toHaveBeenCalledWith("user_id", "user");
    expect(s.query.eq).toHaveBeenCalledWith("storage_path", "old.jpg");
  });
  it("inserts a first photo without removing any objects", async () => {
    const s = setup(undefined, false);
    expect((await uploadProfileMedia(s.client, params())).ok).toBe(true);
    expect(s.query.insert).toHaveBeenCalledOnce();
    expect(s.bucket.remove).not.toHaveBeenCalled();
  });
});
