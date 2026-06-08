import { describe, it, expect } from "vitest";
import { lintEnv, runLint } from "../src/commands/lint.js";
import { parseEnvContent } from "../src/lib/parser.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TMP = join(import.meta.dirname, "__tmp_lint_test__");

describe("lintEnv", () => {
  it("returns no issues for a clean .env", () => {
    const parsed = parseEnvContent("DB_HOST=localhost\nDB_PORT=5432\n# comment\nAPP_NAME=myapp\n");
    const issues = lintEnv(parsed);
    expect(issues).toHaveLength(0);
  });

  it("detects duplicate keys", () => {
    const parsed = parseEnvContent("KEY=one\nKEY=two\n");
    const issues = lintEnv(parsed);
    const dupes = issues.filter((i) => i.rule === "duplicate-key");
    expect(dupes).toHaveLength(1);
    expect(dupes[0].severity).toBe("error");
    expect(dupes[0].line).toBe(2);
  });

  it("detects invalid key names", () => {
    const parsed = parseEnvContent("123BAD=value\n");
    const issues = lintEnv(parsed);
    const invalid = issues.filter((i) => i.rule === "invalid-key");
    expect(invalid).toHaveLength(1);
    expect(invalid[0].severity).toBe("error");
  });

  it("detects trailing whitespace", () => {
    const parsed = parseEnvContent("KEY=value   \n");
    const issues = lintEnv(parsed);
    const trailing = issues.filter((i) => i.rule === "trailing-whitespace");
    expect(trailing).toHaveLength(1);
    expect(trailing[0].severity).toBe("warning");
  });

  it("detects spaces around equals sign", () => {
    const parsed = parseEnvContent("KEY =value\n");
    const issues = lintEnv(parsed);
    const spaces = issues.filter((i) => i.rule === "spaces-around-equals");
    expect(spaces).toHaveLength(1);
    expect(spaces[0].severity).toBe("warning");
  });

  it("detects unquoted values with spaces", () => {
    const parsed = parseEnvContent("KEY=hello world\n");
    const issues = lintEnv(parsed);
    const unquoted = issues.filter((i) => i.rule === "unquoted-spaces");
    expect(unquoted).toHaveLength(1);
    expect(unquoted[0].severity).toBe("warning");
  });

  it("does not flag quoted values with spaces", () => {
    const parsed = parseEnvContent('KEY="hello world"\n');
    const issues = lintEnv(parsed);
    const unquoted = issues.filter((i) => i.rule === "unquoted-spaces");
    expect(unquoted).toHaveLength(0);
  });

  it("does not flag inline comments as unquoted spaces", () => {
    const parsed = parseEnvContent("KEY=value # this is a comment\n");
    const issues = lintEnv(parsed);
    const unquoted = issues.filter((i) => i.rule === "unquoted-spaces");
    expect(unquoted).toHaveLength(0);
  });

  it("detects very long lines", () => {
    const longValue = "a".repeat(600);
    const parsed = parseEnvContent(`KEY=${longValue}\n`);
    const issues = lintEnv(parsed);
    const long = issues.filter((i) => i.rule === "long-line");
    expect(long).toHaveLength(1);
    expect(long[0].severity).toBe("warning");
  });

  it("handles multiple issues in one file", () => {
    const content = "KEY=one\nKEY=two\nBAD KEY=val\n";
    const parsed = parseEnvContent(content);
    const issues = lintEnv(parsed);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("runLint", () => {
  it("returns clean result for valid env", () => {
    mkdirSync(TMP, { recursive: true });
    const file = join(TMP, "good.env");
    writeFileSync(file, "A=1\nB=2\n");

    const result = runLint(file);
    expect(result.clean).toBe(true);
    expect(result.errors).toBe(0);

    rmSync(TMP, { recursive: true });
  });

  it("returns not clean with errors", () => {
    mkdirSync(TMP, { recursive: true });
    const file = join(TMP, "bad.env");
    writeFileSync(file, "KEY=one\nKEY=two\n");

    const result = runLint(file);
    expect(result.clean).toBe(false);
    expect(result.errors).toBe(1);

    rmSync(TMP, { recursive: true });
  });

  it("strict mode fails on warnings", () => {
    mkdirSync(TMP, { recursive: true });
    const file = join(TMP, "warn.env");
    writeFileSync(file, "KEY=hello world\n");

    const result = runLint(file, { strict: true });
    expect(result.clean).toBe(false);

    const resultNonStrict = runLint(file, { strict: false });
    expect(resultNonStrict.clean).toBe(true);

    rmSync(TMP, { recursive: true });
  });
});
