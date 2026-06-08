/**
 * Output formatting — console display and JSON output for all commands.
 *
 * Security: redacts secret values in all output.
 */

import { inspect } from "util";

export interface CheckResult {
  missing: string[];
  extra: string[];
  empty: string[];
  clean: boolean;
}

export interface DiffEntry {
  key: string;
  status: "present" | "missing" | "extra" | "empty" | "mismatch";
  envValue?: string;
  exampleValue?: string;
}

export interface OutputOptions {
  json: boolean;
}

// Pre-compiled regex patterns for performance
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /gh[ps]_[A-Za-z0-9_]{36,}/g,
  /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
  /[A-Za-z0-9/+=]{40}/g,
  /sk-[A-Za-z0-9]{48}/g, // OpenAI API key
  /AIza[0-9A-Za-z_-]{35}/g, // Google API key
  /ghp_[A-Za-z0-9]{36}/g, // GitHub personal access token
  /pk_live_[A-Za-z0-9]{24}/g, // Stripe publishable key
  /whsec_[A-Za-z0-9]{32,}/g, // Slack webhook secret
];

/** Sanitize output data to prevent information leakage */
function sanitizeOutput(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Redact potential secrets in strings
    let sanitized = data;
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeOutput(item));
  }

  if (typeof data === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip redacted fields
      if (key.includes("secret") || key.includes("token") || key.includes("password") || 
          key.includes("key") || key.includes("auth") || key.includes("credential")) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeOutput(value);
      }
    }
    return result;
  }

  return data;
}

/** Format check results for console output. */
export function formatCheckResult(result: CheckResult): string {
  const lines: string[] = [];

  if (result.clean) {
    lines.push("✓ All environment variables are valid");
    return lines.join("\n");
  }

  if (result.missing.length > 0) {
    lines.push("Missing keys:");
    for (const key of result.missing) {
      lines.push(`  ✗ ${key}`);
    }
  }

  if (result.extra.length > 0) {
    lines.push("Extra keys (not in .env.example):");
    for (const key of result.extra) {
      lines.push(`  + ${key}`);
    }
  }

  if (result.empty.length > 0) {
    lines.push("Empty values:");
    for (const key of result.empty) {
      lines.push(`  ! ${key}`);
    }
  }

  return lines.join("\n");
}

/** Format diff results for console output. */
export function formatDiffResult(entries: DiffEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    switch (entry.status) {
      case "present":
        lines.push(`  ✓ ${entry.key}`);
        break;
      case "missing":
        lines.push(`  ✗ ${entry.key} (missing)`);
        break;
      case "extra":
        lines.push(`  + ${entry.key} (extra)`);
        break;
      case "empty":
        lines.push(`  ! ${entry.key} (empty value)`);
        break;
      case "mismatch":
        lines.push(`  ~ ${entry.key} (type mismatch)`);
        break;
    }
  }

  return lines.join("\n");
}

/** Format secret scan results for console output. */
export function formatSecretsResult(
  secrets: Array<{ key: string; line: number; pattern: { name: string; severity: string }; redacted: string }>
): string {
  const lines: string[] = [];

  if (secrets.length === 0) {
    lines.push("✓ No secrets detected");
    return lines.join("\n");
  }

  lines.push(`⚠ Found ${secrets.length} potential secret(s):\n`);

  // Group by severity
  const bySeverity = secrets.reduce((acc, secret) => {
    if (!acc[secret.pattern.severity]) {
      acc[secret.pattern.severity] = [];
    }
    acc[secret.pattern.severity].push(secret);
    return acc;
  }, {} as Record<string, typeof secrets>);

  const severityOrder = ["critical", "high", "medium"];
  
  for (const severity of severityOrder) {
    if (bySeverity[severity]) {
      lines.push(`\n  [${severity.toUpperCase()}] (${bySeverity[severity].length} found):`);
      for (const secret of bySeverity[severity]) {
        lines.push(`    Key: ${secret.key} (line ${secret.line})`);
        lines.push(`    Pattern: ${secret.pattern.name}`);
        lines.push(`    Value: ${secret.redacted}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/** Format type validation violations for console output. */
export function formatTypeViolations(
  violations: Array<{ key: string; expectedType: string; actualValue: string; message: string }>
): string {
  const lines: string[] = [];

  if (violations.length === 0) {
    return "";
  }

  lines.push("Type violations:");
  for (const v of violations) {
    // Redact the actual value in output
    const safeValue = v.actualValue.length > 20 ? 
      v.actualValue.substring(0, 10) + "..." + v.actualValue.substring(v.actualValue.length - 10) : 
      v.actualValue;
    lines.push(`  ✗ ${v.key}: ${v.message} (expected @type ${v.expectedType}, got "${safeValue}")`);
  }

  return lines.join("\n");
}

/** Write JSON output to stdout with error handling. */
export function outputJson(data: unknown): void {
  try {
    const sanitized = sanitizeOutput(data);
    process.stdout.write(JSON.stringify(sanitized, null, 2) + "\n");
  } catch (err) {
    const error = err as Error;
    process.stderr.write(`Error generating JSON output: ${error.message}\n`);
    process.exit(1);
  }
}

/** Write text output to stdout with error handling. */
export function outputText(text: string): void {
  try {
    const sanitized = sanitizeOutput(text);
    process.stdout.write(String(sanitized) + "\n");
  } catch (err) {
    const error = err as Error;
    process.stderr.write(`Error generating text output: ${error.message}\n`);
    process.exit(1);
  }
}

/** Safe output function that handles errors gracefully */
export function safeOutput(data: unknown, useJson: boolean = false): void {
  try {
    if (useJson) {
      outputJson(data);
    } else {
      outputText(String(data));
    }
  } catch (err) {
    const error = err as Error;
    process.stderr.write(`Output error: ${error.message}\n`);
    process.exit(1);
  }
}