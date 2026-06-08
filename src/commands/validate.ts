import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, toEnvMap, extractAnnotations, validateAndResolveFile } from "../lib/parser.js";
import { validateTypes, type TypeViolation } from "../lib/types.js";
import { runCheck } from "./check.js";
import type { CheckResult } from "../lib/output.js";
import { formatTypeViolations, formatCheckResult, outputJson, outputText, type OutputOptions } from "../lib/output.js";

export interface ValidateOptions extends OutputOptions {}

export interface ValidateResult {
  check: CheckResult;
  violations: TypeViolation[];
  valid: boolean;
}

export function runValidate(
  envPath: string,
  examplePath: string,
  options: ValidateOptions = { json: false }
): ValidateResult {
  const checkResult = runCheck(envPath, examplePath, { json: false });

  const exampleFullPath = validateAndResolveFile(examplePath);

  let exampleContent: string;
  try {
    exampleContent = readFileSync(exampleFullPath, "utf-8");
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to read example file ${examplePath}: ${error.message}`);
  }

  const envParsed = parseEnvFile(envPath);
  const envMap = toEnvMap(envParsed);
  const annotations = extractAnnotations(exampleContent);

  const typeAnnotations = new Map<string, string | null>();
  for (const [key, ann] of annotations) {
    if (ann.type) {
      typeAnnotations.set(key, ann.type);
    }
  }

  const violations = validateTypes(envMap, typeAnnotations);

  const valid = checkResult.clean && violations.length === 0;

  if (options.json) {
    outputJson({
      check: checkResult,
      violations,
      valid,
    });
  } else {
    outputText(formatCheckResult(checkResult));
    if (violations.length > 0) {
      outputText(formatTypeViolations(violations));
    }
    if (valid) {
      outputText("✓ All validations passed");
    }
  }

  return { check: checkResult, violations, valid };
}
