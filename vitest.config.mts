import { defineConfig } from "vitest/config";

/**
 * Test setup for the pure logic in `lib/` — scoring, AI criteria extraction,
 * band ranking, and formatting.
 *
 * Scope is deliberately "code that can run without a database or a browser".
 * Server actions and React components are not covered here; they need a real
 * Supabase project or a DOM, which is a much heavier setup for less value than
 * testing the decision logic they call into.
 */
export default defineConfig({
  resolve: {
    // Resolves the "@/..." import alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
