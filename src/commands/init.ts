import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, validateFilePath } from "../lib/parser.js";
import { outputJson, outputText, type OutputOptions } from "../lib/output.js";

export interface InitOptions extends OutputOptions {
  output?: string;
}

export function runInit(envPath: string, options: InitOptions = { json: false }): void {
  const parsed = parseEnvFile(envPath);

  const lines: string[] = [];
  let currentSection = "";

  for (const comment of parsed.comments) {
    if (comment.text.trim() !== "") {
      lines.push(`# ${comment.text}`);
    }
  }

  for (const entry of parsed.entries) {
    const hasValue = entry.value.trim() !== "";
    const annotation = hasValue ? "  # @required" : "";
    lines.push(`${entry.key}=${annotation}`);
  }

  const output = lines.join("\n") + "\n";

  const outputPath = options.output || resolve(resolve(validateFilePath(envPath)), "..", ".env.example");

  writeFileSync(outputPath, output, "utf-8");

  if (options.json) {
    outputJson({ generated: outputPath, keys: parsed.entries.map((e) => e.key) });
  } else {
    outputText(`✓ Generated ${outputPath}`);
  }
}
