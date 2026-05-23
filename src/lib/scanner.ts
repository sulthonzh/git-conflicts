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
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.pattern.test(entry.raw)) {
        // Avoid duplicate matches for the same key
        const alreadyFound = secrets.some((s) => s.key === entry.key && s.pattern.name === pattern.name);
        if (!alreadyFound) {
          secrets.push({
            key: entry.key,
            line: entry.line,
            pattern,
            redacted: redact(entry.value),
          });
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
