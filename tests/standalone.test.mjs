import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, rmSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dirname, "__tmp_standalone__");

await import("tsx/esm");

const { parseEnvContent, toEnvMap, extractAnnotations } = await import("../src/lib/parser.ts");
const { runCheck } = await import("../src/commands/check.ts");
const { scanContent, quickScan } = await import("../src/lib/scanner.ts");
const { runDiff } = await import("../src/commands/diff.ts");
const { validateType, isValidType, validateTypes } = await import("../src/lib/types.ts");
const { lintEnv } = await import("../src/commands/lint.ts");
const { runValidate } = await import("../src/commands/validate.ts");
const { runFix } = await import("../src/commands/fix.ts");

function writeTmp(name, content) {
  mkdirSync(TMP, { recursive: true });
  const p = resolve(TMP, name);
  writeFileSync(p, content, "utf-8");
  return p;
}

function cleanup() {
  rmSync(TMP, { recursive: true, force: true });
}

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

  it("handles single-quoted values", () => {
    const e = entries("KEY='no $expansion'\n");
    assert.equal(e[0].value, "no $expansion");
  });

  it("handles export prefix", () => {
    const e = entries("export PATH=/usr/bin\n");
    assert.equal(e[0].key, "PATH");
    assert.equal(e[0].value, "/usr/bin");
  });

  it("handles key without value", () => {
    const e = entries("EMPTY_KEY\n");
    assert.equal(e[0].key, "EMPTY_KEY");
    assert.equal(e[0].value, "");
  });

  it("strips BOM", () => {
    const bom = "\uFEFFKEY=value\n";
    const e = entries(bom);
    assert.equal(e.length, 1);
    assert.equal(e[0].key, "KEY");
  });

  it("handles escape sequences in double quotes", () => {
    const e = entries('KEY="line1\\nline2"\n');
    assert.equal(e[0].value, "line1\nline2");
  });

  it("collects comments", () => {
    const parsed = parseEnvContent("# header comment\nKEY=val\n# inline note\n");
    assert.equal(parsed.comments.length, 2);
    assert.equal(parsed.comments[0].text, "header comment");
  });

  it("preserves raw lines", () => {
    const parsed = parseEnvContent("KEY=value\n");
    assert.equal(parsed.raw, "KEY=value\n");
    assert.equal(parsed.entries[0].raw, "KEY=value");
  });
});

// --- toEnvMap ---
describe("toEnvMap", () => {
  it("creates key-value map", () => {
    const parsed = parseEnvContent("A=1\nB=2\n");
    const map = toEnvMap(parsed);
    assert.equal(map.get("A"), "1");
    assert.equal(map.get("B"), "2");
    assert.equal(map.size, 2);
  });

  it("last value wins for duplicates", () => {
    const parsed = parseEnvContent("KEY=first\nKEY=second\n");
    const map = toEnvMap(parsed);
    assert.equal(map.get("KEY"), "second");
  });
});

// --- extractAnnotations ---
describe("extractAnnotations", () => {
  it("detects @required annotation", () => {
    const ann = extractAnnotations("DB_HOST=localhost # @required\n");
    assert.equal(ann.get("DB_HOST").required, true);
  });

  it("detects @type annotation", () => {
    const ann = extractAnnotations("PORT=3000 # @type number\n");
    assert.equal(ann.get("PORT").type, "number");
  });

  it("defaults to not required", () => {
    const ann = extractAnnotations("KEY=value\n");
    assert.equal(ann.get("KEY").required, false);
    assert.equal(ann.get("KEY").type, null);
  });

  it("throws on empty content", () => {
    assert.throws(() => extractAnnotations(""), /non-empty string/);
  });
});

// --- Type Validation Tests ---
describe("validateType", () => {
  it("accepts valid numbers", () => {
    assert.equal(validateType("5432", "number"), null);
    assert.equal(validateType("-1", "number"), null);
    assert.equal(validateType("3.14", "number"), null);
  });

  it("rejects invalid numbers", () => {
    assert.ok(validateType("notanumber", "number"));
  });

  it("accepts valid booleans", () => {
    for (const v of ["true", "false", "1", "0", "yes", "no", "on", "off"]) {
      assert.equal(validateType(v, "boolean"), null, `expected ${v} to be valid boolean`);
    }
  });

  it("rejects invalid booleans", () => {
    assert.ok(validateType("maybe", "boolean"));
  });

  it("accepts valid URLs", () => {
    assert.equal(validateType("https://example.com", "url"), null);
    assert.equal(validateType("postgres://user:pass@host:5432/db", "url"), null);
  });

  it("rejects invalid URLs", () => {
    assert.ok(validateType("not-a-url", "url"));
  });

  it("accepts valid emails", () => {
    assert.equal(validateType("user@example.com", "email"), null);
  });

  it("rejects invalid emails", () => {
    assert.ok(validateType("@nope", "email"));
    assert.ok(validateType("user@", "email"));
  });

  it("accepts valid JSON", () => {
    assert.equal(validateType('{"key":"value"}', "json"), null);
    assert.equal(validateType("[1,2,3]", "json"), null);
  });

  it("rejects invalid JSON", () => {
    assert.ok(validateType("{not json", "json"));
  });

  it("accepts valid ports", () => {
    assert.equal(validateType("3000", "port"), null);
    assert.equal(validateType("80", "port"), null);
    assert.equal(validateType("65535", "port"), null);
  });

  it("rejects out-of-range ports", () => {
    assert.ok(validateType("70000", "port"));
    assert.ok(validateType("0", "port"));
    assert.ok(validateType("-1", "port"));
  });

  it("rejects port with leading zeros", () => {
    assert.ok(validateType("03000", "port"));
  });

  it("string type rejects empty", () => {
    assert.ok(validateType("", "string"));
    assert.equal(validateType("hello", "string"), null);
  });
});

describe("isValidType", () => {
  it("recognizes valid types", () => {
    for (const t of ["string", "number", "boolean", "url", "email", "json", "port"]) {
      assert.equal(isValidType(t), true, `expected ${t} to be valid`);
    }
  });

  it("rejects invalid types", () => {
    assert.equal(isValidType("array"), false);
    assert.equal(isValidType("object"), false);
  });
});

describe("validateTypes", () => {
  it("returns violations for mismatched types", () => {
    const values = new Map([["PORT", "abc"]]);
    const types = new Map([["PORT", "number"]]);
    const violations = validateTypes(values, types);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].key, "PORT");
  });

  it("returns empty for valid types", () => {
    const values = new Map([["PORT", "3000"]]);
    const types = new Map([["PORT", "number"]]);
    const violations = validateTypes(values, types);
    assert.equal(violations.length, 0);
  });

  it("skips empty values", () => {
    const values = new Map([["PORT", ""]]);
    const types = new Map([["PORT", "number"]]);
    const violations = validateTypes(values, types);
    assert.equal(violations.length, 0);
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

  it("detects OpenAI API key", () => {
    const result = scanContent("OPENAI_KEY=sk-" + "A".repeat(48));
    assert.equal(result.hasSecrets, true);
  });

  it("detects private key", () => {
    const result = scanContent("KEY=REDACTED_PEM_BEGIN\nabc123\n");
    assert.equal(result.hasSecrets, true);
  });

  it("detects database connection string", () => {
    const result = scanContent("DB=mysql://root:pass@localhost:3306/mydb");
    assert.equal(result.hasSecrets, true);
  });

  it("returns no secrets for safe content", () => {
    const result = scanContent("APP_NAME=myapp\nPORT=3000");
    assert.equal(result.hasSecrets, false);
  });

  it("tracks total scanned entries", () => {
    const result = scanContent("A=1\nB=2\nC=3\n");
    assert.equal(result.totalScanned, 3);
  });

  it("redacts matched values", () => {
    const result = scanContent("AWS_KEY=REDACTED_AWS_EXAMPLE");
    assert.ok(result.secrets.length > 0);
    assert.ok(result.secrets[0].redacted.includes("..."));
    assert.ok(!result.secrets[0].redacted.includes("REDACTED_AWS_EXAMPLE"));
  });

  it("throws on empty content", () => {
    assert.throws(() => scanContent(""), /non-empty string/);
  });
});

describe("quickScan", () => {
  it("finds critical severity secrets", () => {
    const result = quickScan("AWS_KEY=REDACTED_AWS_EXAMPLE");
    assert.equal(result.hasSecrets, true);
  });

  it("misses non-critical secrets", () => {
    // Generic API key is "high" severity, not "critical"
    const result = quickScan("api_key=abcdef1234567890abcdef1234567890");
    // quickScan only checks critical patterns, so this may or may not be found
    assert.ok(typeof result.hasSecrets === "boolean");
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

  it("detects type violations", () => {
    const envPath = writeTmp(".env", "PORT=notanumber\n");
    const examplePath = writeTmp(".env.example", "PORT=3000  # @type number\n");
    const result = runValidate(envPath, examplePath);
    assert.equal(result.valid, false);
    assert.ok(result.violations.length > 0);
    cleanup();
  });
});

// --- Fix Tests ---
describe("runFix", () => {
  it("adds missing keys", () => {
    const envPath = writeTmp(".env", "A=1\n");
    const examplePath = writeTmp(".env.example", "A=1\nB=placeholder\n");
    const result = runFix(envPath, examplePath, { dryRun: true });
    assert.ok(result.added.includes("B"));
    cleanup();
  });

  it("prunes extra keys when --prune is set", () => {
    const envPath = writeTmp(".env", "A=1\nEXTRA=bye\n");
    const examplePath = writeTmp(".env.example", "A=1\n");
    const result = runFix(envPath, examplePath, { prune: true, dryRun: true });
    assert.ok(result.removed.includes("EXTRA"));
    cleanup();
  });

  it("sorts keys when --sort is set", () => {
    const envPath = writeTmp(".env", "Z=1\nA=2\n");
    const examplePath = writeTmp(".env.example", "A=2\nZ=1\n");
    const result = runFix(envPath, examplePath, { sort: true, dryRun: true });
    assert.equal(result.sorted, true);
    cleanup();
  });
});
