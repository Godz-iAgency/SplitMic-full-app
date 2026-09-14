import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

const refresh = vi.hoisted(() => ({ remove: false }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { set: (name: string, value: string, options: object) => void; remove: (name: string, options: object) => void };
  }) => ({ auth: { getUser: async () => {
    options.cookies.set("session.0", "chunk-zero", { path: "/", httpOnly: true });
    options.cookies.set("session.1", "chunk-one", { path: "/", httpOnly: true });
    if (refresh.remove) options.cookies.remove("session.2", { path: "/", maxAge: 0 });
    return { data: { user: null } };
  } } }),
}));

describe("session refresh cookies", () => {
  it("preserves every cookie chunk on the outgoing response", async () => {
    refresh.remove = false;
    const response = await updateSession(new NextRequest("http://localhost/login"));
    expect(response.cookies.get("session.0")?.value).toBe("chunk-zero");
    expect(response.cookies.get("session.1")?.value).toBe("chunk-one");
    expect(response.cookies.get("session.0")?.httpOnly).toBe(true);
  });
  it("clearing an obsolete chunk preserves the refreshed chunks", async () => {
    refresh.remove = true;
    const response = await updateSession(new NextRequest("http://localhost/login"));
    expect(response.cookies.get("session.0")?.value).toBe("chunk-zero");
    expect(response.cookies.get("session.1")?.value).toBe("chunk-one");
    expect(response.cookies.get("session.2")?.maxAge).toBe(0);
  });
});
