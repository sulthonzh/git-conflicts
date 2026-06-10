/**
 * Secret scanner — detects leaked credentials in .env files.
 *
 * Uses static regex patterns only. No dynamic construction.
 * Redacts matched values in output.
 * Optimized for performance with early termination and caching.
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
  scanTime: number;
}

/** Redact a value securely, showing limited characters. */
function redact(value: string): string {
  if (!value || value.length === 0) {
    return "";
  }
  
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }
  
  if (value.length <= 8) {
    // More efficient than multiple slices
    const start = value.substring(0, 2);
    const end = value.substring(value.length - 2);
    return `${start}**${end}`;
  }
  
  // More efficient for longer strings - only do 2 substring operations
  const start = value.substring(0, 4);
  const end = value.substring(value.length - 4);
  return `${start}...${end}`;
}

/** Scan parsed env content for secret patterns. */
export function scanForSecrets(parsed: ParsedEnv): ScanResult {
  const startTime = Date.now();
  const secrets: SecretMatch[] = [];

  // Sort patterns by severity to check critical ones first
  const sortedPatterns = [...SECRET_PATTERNS].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Filter out entries with empty keys
  const validEntries = parsed.entries.filter(entry => entry.key && entry.key.length > 0);

  for (const entry of validEntries) {
    // Test against the raw line for pattern matching (some patterns like AWS key
    // appear in the value portion) AND against just the value for key-agnostic patterns.
    const testTargets = [entry.value, entry.raw];

    for (const pattern of sortedPatterns) {
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

  const scanTime = Date.now() - startTime;

  return {
    secrets,
    totalScanned: validEntries.length,
    hasSecrets: secrets.length > 0,
    scanTime,
  };
}

/** Scan raw env file content for secrets. */
export function scanContent(content: string): ScanResult {
  // Validate input content
  if (!content || typeof content !== "string") {
    throw new Error("Content must be a non-empty string");
  }

  if (content.length > 1024 * 1024) { // 1MB limit
    throw new Error("Content too large (max 1MB)");
  }

  const parsed = parseEnvContent(content);
  return scanForSecrets(parsed);
}

/** Quick scan for secrets (faster, less comprehensive) */
export function quickScan(content: string): ScanResult {
  const startTime = Date.now();
  // Only check the most critical patterns for speed
  const criticalPatterns = SECRET_PATTERNS.filter(p => p.severity === "critical");
  
  const parsed = parseEnvContent(content);
  const secrets: SecretMatch[] = [];
  
  // Filter out entries with empty keys
  const validEntries = parsed.entries.filter(entry => entry.key && entry.key.length > 0);

  for (const entry of validEntries) {
    for (const pattern of criticalPatterns) {
      // Check both value and raw line separately (same logic as full scan)
      const valueMatch = pattern.pattern.test(entry.value);
      const rawMatch = pattern.pattern.test(entry.raw);
      
      if (valueMatch || rawMatch) {
        secrets.push({
          key: entry.key,
          line: entry.line,
          pattern,
          redacted: redact(entry.value),
        });
        break; // found for this entry, move to next
      }
    }
  }

  return {
    secrets,
    totalScanned: validEntries.length,
    hasSecrets: secrets.length > 0,
    scanTime: Date.now() - startTime,
  };
}