/**
 * Lint command — catches structural and quality issues in .env files.
 *
 * Checks for: duplicate keys, invalid key names, inconsistent quoting,
 * trailing whitespace, unquoted values with spaces, spaces around =,
 * and very long lines.
 */

import { parseEnvFile, type ParsedEnv } from "../lib/parser.js";
import { formatLintResult, outputJson, outputText, type OutputOptions } from "../lib/output.js";

export interface LintIssue {
  key: string;
  line: number;
  severity: "error" | "warning";
  rule: string;
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
  totalIssues: number;
  errors: number;
  warnings: number;
  clean: boolean;
}

const MAX_LINE_LENGTH = 500;

/** Valid env key: starts with letter or underscore, then letters/digits/underscores */
const VALID_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function lintEnv(parsed: ParsedEnv): LintIssue[] {
  const issues: LintIssue[] = [];
  const seenKeys = new Map<string, number>(); // key → first line number
  const lines = parsed.raw.split(/\r?\n/);

  for (const entry of parsed.entries) {
    // Duplicate keys
    if (seenKeys.has(entry.key)) {
      issues.push({
        key: entry.key,
        line: entry.line,
        severity: "error",
        rule: "duplicate-key",
        message: `Duplicate key "${entry.key}" (first defined on line ${seenKeys.get(entry.key)}). The last value wins silently.`,
      });
    } else {
      seenKeys.set(entry.key, entry.line);
    }

    // Invalid key name
    if (!VALID_KEY_RE.test(entry.key)) {
      issues.push({
        key: entry.key,
        line: entry.line,
        severity: "error",
        rule: "invalid-key",
        message: `Invalid key name "${entry.key}". Keys must match [A-Za-z_][A-Za-z0-9_]*.`,
      });
    }

    // Spaces around =
    const rawLine = lines[entry.line - 1] || "";
    if (rawLine.includes("=") && /[A-Za-z0-9_]\s+=/.test(rawLine)) {
      issues.push({
        key: entry.key,
        line: entry.line,
        severity: "warning",
        rule: "spaces-around-equals",
        message: `Spaces around "=" in "${entry.key}". Most shells ignore them, but some don't.`,
      });
    }

    // Trailing whitespace in value
    if (rawLine !== rawLine.trimEnd() && !rawLine.trimStart().startsWith("#")) {
      issues.push({
        key: entry.key,
        line: entry.line,
        severity: "warning",
        rule: "trailing-whitespace",
        message: `Trailing whitespace on line ${entry.line}.`,
      });
    }

    // Unquoted value with spaces
    const rawAfterEq = rawLine.slice(rawLine.indexOf("=") + 1);
    const trimmedVal = rawAfterEq.trimStart();
    if (
      trimmedVal.length > 0 &&
      !trimmedVal.startsWith('"') &&
      !trimmedVal.startsWith("'") &&
      /\s/.test(trimmedVal.replace(/\s+#.*$/, "")) // ignore inline comment
    ) {
      issues.push({
        key: entry.key,
        line: entry.line,
        severity: "warning",
        rule: "unquoted-spaces",
        message: `Value for "${entry.key}" contains spaces but is unquoted. Consider wrapping in quotes.`,
      });
    }

    // Very long line
    if (rawLine.length > MAX_LINE_LENGTH) {
      issues.push({
        key: entry.key,
        line: entry.line,
        severity: "warning",
        rule: "long-line",
        message: `Line ${entry.line} is ${rawLine.length} characters (max recommended: ${MAX_LINE_LENGTH}). Consider using file paths or references.`,
      });
    }
  }

  return issues;
}

export interface LintOptions extends OutputOptions {
  /** Fail on warnings too, not just errors. */
  strict?: boolean;
}

export function runLint(envPath: string, options: LintOptions = { json: false, strict: false }): LintResult {
  const parsed = parseEnvFile(envPath);
  const issues = lintEnv(parsed);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const clean = options.strict ? issues.length === 0 : errors === 0;

  if (options.json) {
    outputJson({ issues, totalIssues: issues.length, errors, warnings, clean });
  } else {
    outputText(formatLintResult(issues, errors, warnings, clean));
  }

  return { issues, totalIssues: issues.length, errors, warnings, clean };
}
