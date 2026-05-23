import { describe, it, expect } from "vitest";
import { parseEnvContent, validateFilePath, toEnvMap, extractAnnotations } from "../src/lib/parser.js";

describe("validateFilePath", () => {
  it("accepts simple filenames", () => {
    expect(validateFilePath(".env")).toBe(".env");
  });

  it("accepts relative paths", () => {
    expect(validateFilePath("config/.env")).toBe("config/.env");
  });

  it("rejects path traversal with ..", () => {
    expect(() => validateFilePath("../../etc/passwd")).toThrow("path traversal");
  });

  it("rejects tilde expansion", () => {
    expect(() => validateFilePath("~/.env")).toThrow("path traversal");
  });

  it("rejects empty string", () => {
    expect(() => validateFilePath("")).toThrow("non-empty string");
  });
});

describe("parseEnvContent", () => {
  it("parses simple KEY=VALUE pairs", () => {
    const result = parseEnvContent("DB_HOST=localhost\nDB_PORT=5432");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual(
      expect.objectContaining({ key: "DB_HOST", value: "localhost", line: 1 })
    );
    expect(result.entries[1]).toEqual(
      expect.objectContaining({ key: "DB_PORT", value: "5432", line: 2 })
    );
  });

  it("parses quoted values with double quotes", () => {
    const result = parseEnvContent('KEY="hello world"');
    expect(result.entries[0].value).toBe("hello world");
  });

  it("parses quoted values with single quotes", () => {
    const result = parseEnvContent("KEY='hello world'");
    expect(result.entries[0].value).toBe("hello world");
  });

  it("handles escape sequences in double quotes", () => {
    const result = parseEnvContent('KEY="hello\\nworld"');
    expect(result.entries[0].value).toBe("hello\nworld");
  });

  it("skips comment lines", () => {
    const result = parseEnvContent("# This is a comment\nKEY=value");
    expect(result.entries).toHaveLength(1);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].text).toBe("This is a comment");
  });

  it("skips empty lines", () => {
    const result = parseEnvContent("\n\nKEY=value\n\n");
    expect(result.entries).toHaveLength(1);
  });

  it("handles key without value", () => {
    const result = parseEnvContent("EMPTY_KEY");
    expect(result.entries[0]).toEqual(
      expect.objectContaining({ key: "EMPTY_KEY", value: "" })
    );
  });

  it("handles empty value after equals", () => {
    const result = parseEnvContent("EMPTY_KEY=");
    expect(result.entries[0]).toEqual(
      expect.objectContaining({ key: "EMPTY_KEY", value: "" })
    );
  });

  it("strips export prefix", () => {
    const result = parseEnvContent("export KEY=value");
    expect(result.entries[0]).toEqual(
      expect.objectContaining({ key: "KEY", value: "value" })
    );
  });

  it("strips inline comments from unquoted values", () => {
    const result = parseEnvContent("KEY=value # this is inline");
    expect(result.entries[0].value).toBe("value");
  });

  it("handles BOM", () => {
    const bom = "\uFEFF";
    const result = parseEnvContent(`${bom}KEY=value`);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].key).toBe("KEY");
  });

  it("handles CRLF line endings", () => {
    const result = parseEnvContent("KEY1=value1\r\nKEY2=value2");
    expect(result.entries).toHaveLength(2);
  });
});

describe("toEnvMap", () => {
  it("creates a Map from parsed entries", () => {
    const parsed = parseEnvContent("A=1\nB=2");
    const map = toEnvMap(parsed);
    expect(map.get("A")).toBe("1");
    expect(map.get("B")).toBe("2");
  });

  it("last value wins for duplicate keys", () => {
    const parsed = parseEnvContent("KEY=first\nKEY=second");
    const map = toEnvMap(parsed);
    expect(map.get("KEY")).toBe("second");
  });
});

describe("extractAnnotations", () => {
  it("extracts @required and @type annotations", () => {
    const content = "DATABASE_URL=  # @required @type url\nDB_PORT=5432  # @type number";
    const annotations = extractAnnotations(content);

    const dbUrl = annotations.get("DATABASE_URL");
    expect(dbUrl).toEqual(expect.objectContaining({ required: true, type: "url" }));

    const port = annotations.get("DB_PORT");
    expect(port).toEqual(expect.objectContaining({ required: false, type: "number" }));
  });

  it("defaults to not required with no annotation", () => {
    const content = "SIMPLE_KEY=value";
    const annotations = extractAnnotations(content);
    expect(annotations.get("SIMPLE_KEY")?.required).toBe(false);
  });
});
