import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { runCheck } from "../src/commands/check.js";

const FIXTURES = resolve(__dirname, "fixtures");

describe("check command", () => {
  it("passes for a valid .env against .env.example", () => {
    const result = runCheck(
      resolve(FIXTURES, ".env"),
      resolve(FIXTURES, ".env.example")
    );
    expect(result.clean).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
  });

  it("detects missing keys", () => {
    const result = runCheck(
      resolve(FIXTURES, ".env.missing"),
      resolve(FIXTURES, ".env.example")
    );
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toContain("DB_NAME");
    expect(result.missing).toContain("APP_SECRET");
    expect(result.missing).toContain("DEBUG");
    expect(result.missing).toContain("LOG_LEVEL");
    expect(result.missing).toContain("REDIS_URL");
  });

  it("detects extra keys not in example", () => {
    const result = runCheck(
      resolve(FIXTURES, ".env"),
      resolve(FIXTURES, ".env.example")
    );
    expect(result.extra).toHaveLength(0);
  });

  it("throws for missing env file", () => {
    expect(() =>
      runCheck(resolve(FIXTURES, ".env.nonexistent"), resolve(FIXTURES, ".env.example"))
    ).toThrow();
  });

  it("throws for missing example file", () => {
    expect(() =>
      runCheck(resolve(FIXTURES, ".env"), resolve(FIXTURES, ".env.nonexistent"))
    ).toThrow();
  });
});
