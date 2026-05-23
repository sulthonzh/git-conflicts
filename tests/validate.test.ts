import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { runValidate } from "../src/commands/validate.js";
import { validateType, isValidType, validateTypes } from "../src/lib/types.js";

const FIXTURES = resolve(__dirname, "fixtures");

describe("validateType (unit)", () => {
  it("validates number type correctly", () => {
    expect(validateType("5432", "number")).toBeNull();
    expect(validateType("notanumber", "number")).toBeTruthy();
  });

  it("validates boolean type correctly", () => {
    expect(validateType("true", "boolean")).toBeNull();
    expect(validateType("false", "boolean")).toBeNull();
    expect(validateType("yes", "boolean")).toBeNull();
    expect(validateType("maybe", "boolean")).toBeTruthy();
  });

  it("validates url type correctly", () => {
    expect(validateType("https://example.com", "url")).toBeNull();
    expect(validateType("not-a-url", "url")).toBeTruthy();
  });

  it("validates email type correctly", () => {
    expect(validateType("user@example.com", "email")).toBeNull();
    expect(validateType("not-an-email", "email")).toBeTruthy();
  });

  it("validates json type correctly", () => {
    expect(validateType('{"key":"value"}', "json")).toBeNull();
    expect(validateType("not json", "json")).toBeTruthy();
  });

  it("validates port type correctly", () => {
    expect(validateType("3000", "port")).toBeNull();
    expect(validateType("0", "port")).toBeTruthy();
    expect(validateType("70000", "port")).toBeTruthy();
    expect(validateType("abc", "port")).toBeTruthy();
  });
});

describe("isValidType", () => {
  it("recognizes valid types", () => {
    expect(isValidType("number")).toBe(true);
    expect(isValidType("boolean")).toBe(true);
    expect(isValidType("url")).toBe(true);
    expect(isValidType("email")).toBe(true);
    expect(isValidType("json")).toBe(true);
    expect(isValidType("port")).toBe(true);
  });

  it("rejects invalid types", () => {
    expect(isValidType("array")).toBe(false);
    expect(isValidType("object")).toBe(false);
  });
});

describe("validate command (integration)", () => {
  it("validates a correct .env file", () => {
    const result = runValidate(
      resolve(FIXTURES, ".env"),
      resolve(FIXTURES, ".env.example")
    );
    expect(result.valid).toBe(true);
    expect(result.check.clean).toBe(true);
  });

  it("detects type mismatches", () => {
    const result = runValidate(
      resolve(FIXTURES, ".env.missing"),
      resolve(FIXTURES, ".env.example")
    );
    // .env.missing has DB_PORT=notanumber, example has @type number
    const portViolation = result.violations.find((v) => v.key === "DB_PORT");
    expect(portViolation).toBeTruthy();
    expect(portViolation?.expectedType).toBe("number");
  });
});
