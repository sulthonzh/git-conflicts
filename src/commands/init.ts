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

  // Build a lookup for comments by line number
  const commentByLine = new Map<number, string>();
  for (const comment of parsed.comments) {
    commentByLine.set(comment.line, comment.text);
  }

  // Determine the order of all items by line number to preserve original structure
  const allItems: Array<{ type: "comment"; text: string } | { type: "entry"; key: string; annotation: string }> = [];
  for (const comment of parsed.comments) {
    allItems.push({ type: "comment", text: comment.text });
  }
  for (const entry of parsed.entries) {
    const hasValue = entry.value.trim() !== "";
    const annotation = hasValue ? "  # @required" : "";
    allItems.push({ type: "entry", key: entry.key, annotation });
  }

  // Sort by original line number to preserve interleaved comments
  const sortedLines: Array<{ line: number; item: typeof allItems[number] }> = [];
  for (const comment of parsed.comments) {
    sortedLines.push({ line: comment.line, item: { type: "comment" as const, text: comment.text } });
  }
  for (const entry of parsed.entries) {
    const hasValue = entry.value.trim() !== "";
    const annotation = hasValue ? "  # @required" : "";
    sortedLines.push({ line: entry.line, item: { type: "entry" as const, key: entry.key, annotation } });
  }
  sortedLines.sort((a, b) => a.line - b.line);

  for (const { item } of sortedLines) {
    if (item.type === "comment") {
      if (item.text.trim() !== "") {
        lines.push(`# ${item.text}`);
      }
    } else {
      lines.push(`${item.key}=${item.annotation}`);
    }
  }

  const output = lines.join("\n") + "\n";

  let outputPath: string;
  if (options.output) {
    outputPath = validateFilePath(options.output);
  } else {
    outputPath = resolve(resolve(envPath), "..", ".env.example");
  }

  writeFileSync(outputPath, output, "utf-8");

  if (options.json) {
    outputJson({ generated: outputPath, keys: parsed.entries.map((e) => e.key) });
  } else {
    outputText(`✓ Generated ${outputPath}`);
  }
}
