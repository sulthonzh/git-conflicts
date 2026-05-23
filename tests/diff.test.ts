import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { runDiff } from "../src/commands/diff.js";

const FIXTURES = resolve(__dirname, "fixtures");

describe("diff command", () => {
  it("shows all keys as present for matching files", () => {
    const entries = runDiff(
      resolve(FIXTURES, ".env"),
      resolve(FIXTURES, ".env.example")
    );
    const presentKeys = entries.filter((e) => e.status === "present");
    expect(presentKeys.length).toBeGreaterThan(0);
  });

  it("detects missing keys", () => {
    const entries = runDiff(
      resolve(FIXTURES, ".env.missing"),
      resolve(FIXTURES, ".env.example")
    );
    const missing = entries.filter((e) => e.status === "missing");
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.map((e) => e.key)).toContain("DB_NAME");
  });

  it("includes envValue for present keys", () => {
    const entries = runDiff(
      resolve(FIXTURES, ".env"),
      resolve(FIXTURES, ".env.example")
    );
    const present = entries.find((e) => e.key === "DATABASE_URL");
    expect(present?.envValue).toBe("postgresql://user:pass@localhost:5432/mydb");
  });
});
