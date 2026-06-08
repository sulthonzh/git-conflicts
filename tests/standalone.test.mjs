import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, rmSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dirname, "__tmp_standalone__");

await import("tsx/esm");

const { parseEnvContent } = await import("../src/lib/parser.ts");
const { runCheck } = await import("../src/commands/check.ts");
const { scanContent } = await import("../src/lib/scanner.ts");
const { runDiff } = await import("../src/commands/diff.ts");
const { validateType, isValidType } = await import("../src/lib/types.ts");
const { lintEnv } = await import("../src/commands/lint.ts");
const { runValidate } = await import("../src/commands/validate.ts");

function writeTmp(name, content) {
  mkdirSync(TMP, { recursive: true });
  const p = resolve(TMP, name);
  writeFileSync(p, content, "utf-8");
  return p;
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

// parseEnvContent returns { entries, comments, raw }
function entries(content) {
  return parseEnvContent(content).entries;
}

// --- Parser Tests ---
describe("parseEnvContent", () => {
  it("parses simple key=value pairs", () => {
    const e = entries("DB_HOST=localhost\nDB_PORT=5432\n");
    assert.equal(e.length, 2);
    assert.equal(e[0].key, "DB_HOST");
    assert.equal(e[0].value, "localhost");
    assert.equal(e[1].key, "DB_PORT");
    assert.equal(e[1].value, "5432");
  });

  it("handles inline comments", () => {
    const e = entries("KEY=value # a comment\n");
    assert.equal(e[0].value, "value");
  });

  it("skips comment lines", () => {
    const e = entries("# comment\nKEY=val\n");
    assert.equal(e.length, 1);
    assert.equal(e[0].key, "KEY");
  });

  it("handles empty lines", () => {
    const e = entries("\n\nKEY=val\n\n");
    assert.equal(e.length, 1);
  });

  it("handles quoted values", () => {
    const e = entries('KEY="hello world"\n');
    assert.equal(e[0].value, "hello world");
  });
});

// --- Type Validation Tests ---
describe("validateType", () => {
  it("accepts valid numbers", () => {
    assert.equal(validateType("5432", "number"), null);
  });

  it("rejects invalid numbers", () => {
    assert.ok(validateType("notanumber", "number"));
  });

  it("accepts valid booleans", () => {
    assert.equal(validateType("true", "boolean"), null);
    assert.equal(validateType("false", "boolean"), null);
  });

  it("rejects invalid booleans", () => {
    assert.ok(validateType("maybe", "boolean"));
  });

  it("accepts valid URLs", () => {
    assert.equal(validateType("https://example.com", "url"), null);
  });

  it("rejects invalid URLs", () => {
    assert.ok(validateType("not-a-url", "url"));
  });

  it("accepts valid emails", () => {
    assert.equal(validateType("user@example.com", "email"), null);
  });

  it("accepts valid JSON", () => {
    assert.equal(validateType('{"key":"value"}', "json"), null);
  });

  it("accepts valid ports", () => {
    assert.equal(validateType("3000", "port"), null);
  });

  it("rejects out-of-range ports", () => {
    assert.ok(validateType("70000", "port"));
    assert.ok(validateType("0", "port"));
  });
});

describe("isValidType", () => {
  it("recognizes valid types", () => {
    assert.equal(isValidType("number"), true);
    assert.equal(isValidType("boolean"), true);
    assert.equal(isValidType("url"), true);
    assert.equal(isValidType("email"), true);
    assert.equal(isValidType("json"), true);
    assert.equal(isValidType("port"), true);
  });

  it("rejects invalid types", () => {
    assert.equal(isValidType("array"), false);
    assert.equal(isValidType("object"), false);
  });
});

// --- Check Tests ---
describe("runCheck", () => {
  it("detects missing keys", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\nDB_NAME=mydb\n");
    const result = runCheck(envPath, examplePath);
    assert.ok(result.missing.includes("DB_NAME"));
    cleanup();
  });

  it("detects extra keys in strict mode", () => {
    const envPath = writeTmp(".env", "DB_HOST=localhost\nEXTRA=value\n");
    const examplePath = writeTmp(".env.example", "DB_HOST=localhost\n");
    const strict = runCheck(envPath, examplePath, { strict: true });
    assert.equal(strict.clean, false);
    assert.ok(strict.extra.includes("EXTRA"));
    cleanup();
  });

  it("passes for matching files", () => {
    const envPath = writeTmp(".env", "A=1\nB=2\n");
    const examplePath = writeTmp(".env.example", "A=1\nB=2\n");
    const result = runCheck(envPath, examplePath);
    assert.equal(result.clean, true);
    cleanup();
  });
});

// --- Secrets Scanner Tests ---
describe("scanContent", () => {
  it("detects AWS access key pattern", () => {
    const result = scanContent("AWS_KEY=REDACTED_AWS_EXAMPLE");
    assert.equal(result.hasSecrets, true);
  });

  it("detects GitHub token", () => {
    const result = scanContent("TOKEN=REDACTED_GH_TOKEN");
    assert.equal(result.hasSecrets, true);
  });

  it("returns no secrets for safe content", () => {
    const result = scanContent("APP_NAME=myapp\nPORT=3000");
    assert.equal(result.hasSecrets, false);
  });
});

// --- Lint Tests ---
describe("lintEnv", () => {
  it("detects duplicate keys", () => {
    const parsed = parseEnvContent("KEY=one\nKEY=two\n");
    const issues = lintEnv(parsed);
    const dupes = issues.filter(i => i.rule === "duplicate-key");
    assert.equal(dupes.length, 1);
  });

  it("detects trailing whitespace", () => {
    const parsed = parseEnvContent("KEY=value   \n");
    const issues = lintEnv(parsed);
    const trailing = issues.filter(i => i.rule === "trailing-whitespace");
    assert.equal(trailing.length, 1);
  });

  it("detects spaces around equals", () => {
    const parsed = parseEnvContent("KEY =value\n");
    const issues = lintEnv(parsed);
    const spaces = issues.filter(i => i.rule === "spaces-around-equals");
    assert.equal(spaces.length, 1);
  });

  it("detects unquoted values with spaces", () => {
    const parsed = parseEnvContent("KEY=hello world\n");
    const issues = lintEnv(parsed);
    const unquoted = issues.filter(i => i.rule === "unquoted-spaces");
    assert.equal(unquoted.length, 1);
  });

  it("no issues for clean env", () => {
    const parsed = parseEnvContent("A=1\nB=2\n# comment\n");
    const issues = lintEnv(parsed);
    assert.equal(issues.length, 0);
  });
});

// --- Diff Tests ---
describe("runDiff", () => {
  it("detects missing keys", () => {
    const envPath = writeTmp(".env", "A=1\n");
    const examplePath = writeTmp(".env.example", "A=1\nB=2\n");
    const result = runDiff(envPath, examplePath);
    const missing = result.filter(e => e.status === "missing");
    assert.ok(missing.length > 0);
    assert.ok(missing.some(e => e.key === "B"));
    cleanup();
  });

  it("shows present keys with values", () => {
    const envPath = writeTmp(".env", "A=hello\nB=world\n");
    const examplePath = writeTmp(".env.example", "A=1\nB=2\n");
    const result = runDiff(envPath, examplePath);
    const present = result.find(e => e.key === "A");
    assert.equal(present.envValue, "hello");
    cleanup();
  });
});

// --- Validate Integration ---
describe("runValidate", () => {
  it("validates a correct env file", () => {
    const envPath = writeTmp(".env", "PORT=3000\nDEBUG=true\nURL=https://example.com\n");
    const examplePath = writeTmp(".env.example", "PORT=3000  # @type number\nDEBUG=true  # @type boolean\nURL=https://example.com  # @type url\n");
    const result = runValidate(envPath, examplePath);
    assert.equal(result.valid, true);
    cleanup();
  });
});
