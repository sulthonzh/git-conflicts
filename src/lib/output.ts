/**
 * Output formatting — console display and JSON output for all commands.
 *
 * Security: redacts secret values in all output.
 */

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

  for (const secret of secrets) {
    lines.push(`  [${secret.pattern.severity.toUpperCase()}] ${secret.pattern.name}`);
    lines.push(`    Key: ${secret.key} (line ${secret.line})`);
    lines.push(`    Value: ${secret.redacted}`);
    lines.push("");
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
    lines.push(`  ✗ ${v.key}: ${v.message} (expected @type ${v.expectedType})`);
  }

  return lines.join("\n");
}

/** Write JSON output to stdout. */
export function outputJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

/** Write text output to stdout. */
export function outputText(text: string): void {
  process.stdout.write(text + "\n");
}
