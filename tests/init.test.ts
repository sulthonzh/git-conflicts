import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "path";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { runInit } from "../src/commands/init.js";

const FIXTURES = resolve(__dirname, "fixtures");
const OUTPUT_PATH = resolve(FIXTURES, ".env.generated");

describe("init command", () => {
  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      unlinkSync(OUTPUT_PATH);
    }
  });

  it("generates .env.example from .env", () => {
    runInit(resolve(FIXTURES, ".env"), { output: OUTPUT_PATH });

    const generated = readFileSync(OUTPUT_PATH, "utf-8");
    expect(generated).toContain("DATABASE_URL=");
    expect(generated).toContain("DB_PORT=");
    expect(generated).toContain("APP_SECRET=");
    expect(generated).toContain("@required");
  });

  it("marks non-empty values as @required", () => {
    runInit(resolve(FIXTURES, ".env"), { output: OUTPUT_PATH });

    const generated = readFileSync(OUTPUT_PATH, "utf-8");
    expect(generated).toMatch(/DATABASE_URL=.*@required/);
  });

  it("does not mark empty values as @required", () => {
    const tmpEnv = resolve(FIXTURES, ".env.init.tmp");
    writeFileSync(tmpEnv, "EMPTY_KEY=\nFILLED_KEY=value\n");
    
    const outputPath = resolve(FIXTURES, ".env.generated2");
    
    runInit(tmpEnv, { output: outputPath });

    const generated = readFileSync(outputPath, "utf-8");
    expect(generated).toMatch(/EMPTY_KEY=$/m);
    expect(generated).toMatch(/FILLED_KEY=.*@required/);

    unlinkSync(tmpEnv);
    unlinkSync(outputPath);
  });
});
