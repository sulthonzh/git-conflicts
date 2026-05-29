/**
 * Secret scanner — detects leaked credentials in .env files.
 *
 * Uses static regex patterns only. No dynamic construction.
 * Redacts matched values in output.
 */

import { parseEnvContent, type ParsedEnv } from "./parser.js";
import { SECRET_PATTERNS, type SecretPattern } from "../templates/patterns.js";

export interface SecretMatch {
  key: string;
  line: number;
  pattern: SecretPattern;
  redacted: string;
}

export interface ScanResult {
  secrets: SecretMatch[];
  totalScanned: number;
  hasSecrets: boolean;
}

/** Redact a value, showing only first 4 and last 4 chars. */
function redact(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/** Scan parsed env content for secret patterns. */
export function scanForSecrets(parsed: ParsedEnv): ScanResult {
  const secrets: SecretMatch[] = [];

  for (const entry of parsed.entries) {
    // Test against the raw line for pattern matching (some patterns like AWS key
    // appear in the value portion) AND against just the value for key-agnostic patterns.
    // Also test the raw line to catch key=value patterns (e.g. "api_key=...").
    const testTargets = [entry.value, entry.raw];

    for (const pattern of SECRET_PATTERNS) {
      // Avoid duplicate matches for the same key
      const alreadyFound = secrets.some((s) => s.key === entry.key && s.pattern.name === pattern.name);
      if (alreadyFound) continue;

      for (const target of testTargets) {
        if (pattern.pattern.test(target)) {
          secrets.push({
            key: entry.key,
            line: entry.line,
            pattern,
            redacted: redact(entry.value),
          });
          break; // found for this pattern, move to next
        }
      }
    }
  }

  return {
    secrets,
    totalScanned: parsed.entries.length,
    hasSecrets: secrets.length > 0,
  };
}

/** Scan raw env file content for secrets. */
export function scanContent(content: string): ScanResult {
  const parsed = parseEnvContent(content);
  return scanForSecrets(parsed);
}
