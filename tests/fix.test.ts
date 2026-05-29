import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "path";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { runFix } from "../src/commands/fix.js";
import { runCheck } from "../src/commands/check.js";

const TMPDIR = resolve(__dirname, "fixtures-tmp-fix");

describe("fix command", () => {
  beforeEach(() => {
    mkdirSync(TMPDIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMPDIR, { recursive: true, force: true });
  });

  function writeTmp(name: string, content: string): string {
    const p = resolve(TMPDIR, name);
    writeFileSync(p, content, "utf-8");
    return p;
  }

  it("adds missing keys from .env.example", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nDB_PORT=5432\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=mydb\n");

    const result = runFix(envPath, examplePath, { json: false });

    expect(result.added).toEqual(["DB_NAME"]);
    expect(result.removed).toEqual([]);

    const fixed = readFileSync(envPath, "utf-8");
    expect(fixed).toContain("DB_NAME=");
  });

  it("preserves existing values for keys that exist", () => {
    const envPath = writeTmp(".env", "DB_HOST=prod-server\nDB_PORT=3306\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_PORT=5432\n");

    runFix(envPath, examplePath);

    const fixed = readFileSync(envPath, "utf-8");
    expect(fixed).toContain("DB_HOST=prod-server");
    expect(fixed).toContain("DB_PORT=3306");
  });

  it("removes extra keys with --prune", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nEXTRA_KEY=value\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\n");

    const result = runFix(envPath, examplePath, { prune: true });

    expect(result.removed).toEqual(["EXTRA_KEY"]);
    const fixed = readFileSync(envPath, "utf-8");
    expect(fixed).not.toContain("EXTRA_KEY");
  });

  it("keeps extra keys without --prune", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nEXTRA_KEY=value\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\n");

    const result = runFix(envPath, examplePath);

    expect(result.removed).toEqual([]);
    const fixed = readFileSync(envPath, "utf-8");
    expect(fixed).toContain("EXTRA_KEY=value");
  });

  it("sorts keys with --sort", () => {
    const envPath = writeTmp(".env", "ZEBRA=1\nAPPLE=2\nMANGO=3\n");
    const examplePath = writeTmp(".env.example", "ZEBRA=1\nAPPLE=2\nMANGO=3\n");

    const result = runFix(envPath, examplePath, { sort: true });

    expect(result.sorted).toBe(true);
    const fixed = readFileSync(envPath, "utf-8");
    const lines = fixed.trim().split("\n").filter((l: string) => !l.startsWith("#"));
    const appleIdx = lines.findIndex((l: string) => l.startsWith("APPLE"));
    const mangoIdx = lines.findIndex((l: string) => l.startsWith("MANGO"));
    const zebraIdx = lines.findIndex((l: string) => l.startsWith("ZEBRA"));
    expect(appleIdx).toBeLessThan(mangoIdx);
    expect(mangoIdx).toBeLessThan(zebraIdx);
  });

  it("does not write in dry-run mode", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_NAME=mydb\n");

    const original = readFileSync(envPath, "utf-8");
    const result = runFix(envPath, examplePath, { dryRun: true });

    expect(result.added).toEqual(["DB_NAME"]);
    // File should not have changed
    expect(readFileSync(envPath, "utf-8")).toBe(original);
  });

  it("writes to custom output path", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_NAME=mydb\n");
    const outputPath = resolve(TMPDIR, ".env.fixed");

    const result = runFix(envPath, examplePath, { output: outputPath });

    expect(result.outputPath).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);
    const fixed = readFileSync(outputPath, "utf-8");
    expect(fixed).toContain("DB_NAME=");
  });

  it("reports no changes when already in sync", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nDB_PORT=5432\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_PORT=5432\n");

    const result = runFix(envPath, examplePath);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("throws for missing example file", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\n");
    expect(() => runFix(envPath, "/nonexistent/.env.example")).toThrow();
  });
});

describe("check --strict", () => {
  beforeEach(() => {
    mkdirSync(TMPDIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMPDIR, { recursive: true, force: true });
  });

  function writeTmp(name: string, content: string): string {
    const p = resolve(TMPDIR, name);
    writeFileSync(p, content, "utf-8");
    return p;
  }

  it("fails on extra keys in strict mode", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nEXTRA=value\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\n");

    const normal = runCheck(envPath, examplePath, { strict: false });
    const strict = runCheck(envPath, examplePath, { strict: true });

    expect(normal.clean).toBe(true);
    expect(normal.extra).toHaveLength(0);

    expect(strict.clean).toBe(false);
    expect(strict.extra).toContain("EXTRA");
  });

  it("fails on all empty values in strict mode, not just @required", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nDB_NAME=\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_NAME=mydb\n");

    const normal = runCheck(envPath, examplePath, { strict: false });
    const strict = runCheck(envPath, examplePath, { strict: true });

    expect(normal.clean).toBe(true);
    expect(strict.clean).toBe(false);
    expect(strict.empty).toContain("DB_NAME");
  });
});
