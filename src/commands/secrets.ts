import { parseEnvFile } from "../lib/parser.js";
import { scanForSecrets, type ScanResult } from "../lib/scanner.js";
import { formatSecretsResult, outputJson, outputText, type OutputOptions } from "../lib/output.js";

export interface SecretsOptions extends OutputOptions {}

export function runSecrets(envPath: string, options: SecretsOptions = { json: false }): ScanResult {
  const parsed = parseEnvFile(envPath);
  const result = scanForSecrets(parsed);

  if (options.json) {
    const serializable = {
      totalScanned: result.totalScanned,
      hasSecrets: result.hasSecrets,
      secrets: result.secrets.map((s) => ({
        key: s.key,
        line: s.line,
        pattern: s.pattern.name,
        severity: s.pattern.severity,
        redacted: s.redacted,
      })),
    };
    outputJson(serializable);
  } else {
    outputText(formatSecretsResult(result.secrets));
  }

  return result;
}
