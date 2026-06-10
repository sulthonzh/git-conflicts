/**
 * Summary command — generates a health overview of an .env file.
 *
 * Combines validation, lint, and secret scanning into one report.
 * Useful for CI PR comments and quick audits.
 */

import { parseEnvFile } from "../lib/parser.js";
import { scanForSecrets } from "../lib/scanner.js";
import { lintEnv } from "./lint.js";

export interface SummaryResult {
  file: string;
  totalKeys: number;
  emptyValues: number;
  duplicateKeys: number;
  lintIssues: number;
  secretsFound: number;
  secretDetails: Array<{ key: string; pattern: string; severity: string }>;
  health: "healthy" | "warning" | "critical";
}

export function runSummary(
  envPath: string,
  examplePath?: string,
  options: { json?: boolean; markdown?: boolean } = {}
): SummaryResult {
  const parsed = parseEnvFile(envPath);
  const entries = parsed.entries.filter((e) => e.key.length > 0);

  // Count empty values
  const emptyValues = entries.filter((e) => e.value.length === 0).length;

  // Detect duplicate keys
  const seen = new Map<string, number>();
  for (const e of entries) {
    seen.set(e.key, (seen.get(e.key) || 0) + 1);
  }
  const duplicateKeys = [...seen.values()].filter((c) => c > 1).length;

  // Lint issues
  const lintIssues = lintEnv(parsed);
  const lintCount = lintIssues.length;

  // Secret scan
  const scanResult = scanForSecrets(parsed);
  const secretsFound = scanResult.secrets.length;
  const secretDetails = scanResult.secrets.map((s) => ({
    key: s.key,
    pattern: s.pattern.name,
    severity: s.pattern.severity,
  }));

  // Check for missing required keys from example
  let missingRequired = 0;
  if (examplePath) {
    try {
      const exampleParsed = parseEnvFile(examplePath);
      const envKeys = new Set(entries.map((e) => e.key));
      for (const e of exampleParsed.entries) {
        const comment = e.comment || "";
        if (comment.includes("@required") && !envKeys.has(e.key)) {
          missingRequired++;
        }
      }
    } catch {
      // example file optional
    }
  }

  // Determine health
  let health: "healthy" | "warning" | "critical" = "healthy";
  if (secretsFound > 0 || missingRequired > 0) {
    health = "critical";
  } else if (emptyValues > 0 || duplicateKeys > 0 || lintCount > 0) {
    health = "warning";
  }

  const result: SummaryResult = {
    file: envPath,
    totalKeys: entries.length,
    emptyValues,
    duplicateKeys,
    lintIssues: lintCount,
    secretsFound,
    secretDetails,
    health,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (options.markdown) {
    console.log(formatMarkdownSummary(result));
  } else {
    console.log(formatTextSummary(result));
  }

  return result;
}

function healthBadge(health: string): string {
  switch (health) {
    case "healthy":
      return "✅ HEALTHY";
    case "warning":
      return "⚠️ WARNING";
    case "critical":
      return "🔴 CRITICAL";
    default:
      return health;
  }
}

function formatTextSummary(r: SummaryResult): string {
  const lines: string[] = [];
  lines.push(`envguard summary — ${r.file}`);
  lines.push(`${"─".repeat(40)}`);
  lines.push(`Status:    ${healthBadge(r.health)}`);
  lines.push(`Keys:      ${r.totalKeys}`);
  lines.push(`Empty:     ${r.emptyValues}`);
  lines.push(`Duplicates:${r.duplicateKeys}`);
  lines.push(`Lint:      ${r.lintIssues} issues`);
  lines.push(`Secrets:   ${r.secretsFound} found`);

  if (r.secretDetails.length > 0) {
    lines.push("");
    lines.push("Secrets detected:");
    for (const s of r.secretDetails) {
      const sev = s.severity === "critical" ? "🔴" : s.severity === "high" ? "🟠" : "🟡";
      lines.push(`  ${sev} ${s.key} — ${s.pattern}`);
    }
  }

  return lines.join("\n");
}

function formatMarkdownSummary(r: SummaryResult): string {
  const lines: string[] = [];
  lines.push(`## envguard summary — \`${r.file}\``);
  lines.push("");

  const badge = r.health === "healthy" ? "✅" : r.health === "warning" ? "⚠️" : "🔴";
  lines.push(`**Status:** ${badge} ${r.health.toUpperCase()}`);
  lines.push("");

  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Keys | ${r.totalKeys} |`);
  lines.push(`| Empty values | ${r.emptyValues} |`);
  lines.push(`| Duplicate keys | ${r.duplicateKeys} |`);
  lines.push(`| Lint issues | ${r.lintIssues} |`);
  lines.push(`| Secrets found | ${r.secretsFound} |`);

  if (r.secretDetails.length > 0) {
    lines.push("");
    lines.push("### Secrets");
    lines.push("");
    lines.push("| Key | Pattern | Severity |");
    lines.push("|-----|---------|----------|");
    for (const s of r.secretDetails) {
      const sev = s.severity === "critical" ? "🔴 critical" : s.severity === "high" ? "🟠 high" : "🟡 medium";
      lines.push(`| \`${s.key}\` | ${s.pattern} | ${sev} |`);
    }
  }

  return lines.join("\n");
}
