import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { runSecrets } from "../src/commands/secrets.js";
import { scanForSecrets, scanContent } from "../src/lib/scanner.js";
import { parseEnvContent } from "../src/lib/parser.js";

const FIXTURES = resolve(__dirname, "fixtures");

describe("secrets command", () => {
  it("detects secrets in .env.secrets fixture", () => {
    const result = runSecrets(resolve(FIXTURES, ".env.secrets"));
    expect(result.hasSecrets).toBe(true);
    expect(result.secrets.length).toBeGreaterThan(0);
  });

  it("finds no secrets in clean .env fixture", () => {
    const result = runSecrets(resolve(FIXTURES, ".env"));
    expect(result.hasSecrets).toBe(false);
    expect(result.secrets).toHaveLength(0);
  });

  it("redacts secret values", () => {
    const result = runSecrets(resolve(FIXTURES, ".env.secrets"));
    for (const secret of result.secrets) {
      expect(secret.redacted).not.toMatch(/AKIA[0-9A-Z]{16}/);
    }
  });

  it("reports line numbers for secrets", () => {
    const result = runSecrets(resolve(FIXTURES, ".env.secrets"));
    for (const secret of result.secrets) {
      expect(secret.line).toBeGreaterThan(0);
    }
  });
});

describe("scanContent (unit)", () => {
  it("detects AWS access key pattern", () => {
    const result = scanContent("AWS_KEY=REDACTED_AWS_EXAMPLE");
    expect(result.hasSecrets).toBe(true);
    expect(result.secrets[0].pattern.name).toBe("AWS Access Key ID");
  });

  it("detects GitHub token", () => {
    const result = scanContent("GITHUB_TOKEN=REDACTED_GH_TOKEN");
    expect(result.hasSecrets).toBe(true);
    expect(result.secrets.some((s) => s.pattern.name === "GitHub Token")).toBe(true);
  });

  it("detects private key", () => {
    const result = scanContent("PRIVATE_KEY=REDACTED_PEM_BEGIN\nabc123");
    expect(result.hasSecrets).toBe(true);
    expect(result.secrets.some((s) => s.pattern.name === "Private Key")).toBe(true);
  });

  it("detects JWT", () => {
    const result = scanContent("TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456");
    expect(result.hasSecrets).toBe(true);
    expect(result.secrets.some((s) => s.pattern.name === "JWT")).toBe(true);
  });

  it("returns no secrets for safe content", () => {
    const result = scanContent("APP_NAME=myapp\nPORT=3000");
    expect(result.hasSecrets).toBe(false);
  });
});
