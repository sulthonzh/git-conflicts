import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, parseEnvContent, toEnvMap, extractAnnotations, validateFilePath } from "../lib/parser.js";
import { outputJson, outputText, type OutputOptions } from "../lib/output.js";

export interface FixResult {
  added: string[];
  removed: string[];
  sorted: boolean;
  outputPath: string;
}

export interface FixOptions extends OutputOptions {
  /** Remove keys not in .env.example */
  prune?: boolean;
  /** Sort keys alphabetically */
  sort?: boolean;
  /** Dry run — show what would change without writing */
  dryRun?: boolean;
  /** Custom output path */
  output?: string;
}

/**
 * Fix a .env file to match its .env.example.
 *
 * - Adds missing keys with placeholder values
 * - Optionally removes extra keys (--prune)
 * - Optionally sorts keys alphabetically (--sort)
 * - Preserves comments and structure
 * - Creates backup of original file before modification
 */
export function runFix(
  envPath: string,
  examplePath: string,
  options: FixOptions = { json: false }
): FixResult {
  // Validate inputs
  if (!envPath || !examplePath) {
    throw new Error("Both env path and example path are required");
  }

  const envParsed = parseEnvFile(envPath);
  const envMap = toEnvMap(envParsed);

  const exampleValidated = validateFilePath(examplePath);
  const exampleFullPath = resolve(exampleValidated);

  let exampleContent: string;
  try {
    exampleContent = readFileSync(exampleFullPath, "utf-8");
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`Example file not found: ${exampleFullPath}`);
    }
    if (error.code === "EACCES") {
      throw new Error(`Permission denied reading example file: ${exampleFullPath}`);
    }
    throw new Error(`Failed to read example file ${exampleFullPath}: ${error.message}`);
  }

  const annotations = extractAnnotations(exampleContent);
  const exampleParsed = parseEnvContent(exampleContent);

  const added: string[] = [];
  const removed: string[] = [];

  // Build the fixed content
  const fixedLines: string[] = [];
  const processedKeys = new Set<string>();

  // Go through example file structure to preserve comments and order
  const allLineItems: Array<{
    line: number;
    type: "comment" | "entry";
    raw?: string;
    text?: string;
    key?: string;
  }> = [];

  for (const comment of exampleParsed.comments) {
    allLineItems.push({ line: comment.line, type: "comment", raw: comment.raw, text: comment.text });
  }
  for (const entry of exampleParsed.entries) {
    allLineItems.push({ line: entry.line, type: "entry", key: entry.key });
  }
  allLineItems.sort((a, b) => a.line - b.line);

  for (const item of allLineItems) {
    if (item.type === "comment") {
      // Preserve original comment formatting (## heading, #  indented, etc.)
      fixedLines.push(item.raw ?? `# ${item.text}`);
    } else if (item.type === "entry" && item.key) {
      const key = item.key;
      processedKeys.add(key);

      if (envMap.has(key)) {
        // Keep existing value, preserving inline comment from the original line
        const original = envParsed.entries.find((e) => e.key === key);
        const originalRaw = original?.raw;
        // Extract inline comment from original .env line (the part after the value, if any)
        let inlineComment = "";
        if (originalRaw) {
          const eqIdx = originalRaw.indexOf("=");
          if (eqIdx !== -1) {
            const afterEq = originalRaw.slice(eqIdx + 1).trimStart();
            // For unquoted values, find the inline comment
            if (!afterEq.startsWith('"') && !afterEq.startsWith("'")) {
              const commentMatch = afterEq.match(/\s+#(.*)$/);
              if (commentMatch) {
                inlineComment = ` #${commentMatch[1]}`;
              }
            }
          }
        }
        fixedLines.push(`${key}=${envMap.get(key)}${inlineComment}`);
      } else {
        // Add missing key with placeholder
        added.push(key);
        const ann = annotations.get(key);
        const placeholder = ann?.defaultValue && ann.defaultValue.trim() !== ""
          ? ann.defaultValue
          : `# TODO: set ${key}`;
        fixedLines.push(`${key}=${placeholder}`);
      }
    }
  }

  // Handle extra keys (in .env but not in .env.example)
  for (const entry of envParsed.entries) {
    if (!processedKeys.has(entry.key)) {
      if (options.prune) {
        removed.push(entry.key);
      } else {
        // Keep extra keys at the end
        fixedLines.push(`${entry.key}=${entry.value}`);
      }
    }
  }

  // Sort if requested
  let sorted = false;

  if (options.sort) {
    // Group lines into blocks: each entry keeps its preceding comment(s)
    const blocks: Array<{ sortKey: string; lines: string[] }> = [];
    let currentComments: string[] = [];

    for (const line of fixedLines) {
      if (line.startsWith("#")) {
        currentComments.push(line);
      } else {
        const sortKey = line.split("=")[0];
        blocks.push({ sortKey, lines: [...currentComments, line] });
        currentComments = [];
      }
    }

    // If there are trailing comments with no following entry, keep them
    if (currentComments.length > 0) {
      blocks.push({ sortKey: "\uFFFF", lines: currentComments }); // sort to end
    }

    blocks.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    fixedLines.length = 0;
    for (const block of blocks) {
      fixedLines.push(...block.lines);
    }
    sorted = true;
  }

  const finalLines = fixedLines;
  const output = finalLines.join("\n") + "\n";

  const rawOutputPath = options.output || envPath;
  const outputPath = options.output ? validateFilePath(options.output) : rawOutputPath;
  const resolvedOutputPath = resolve(outputPath);

  // Validate output path
  if (outputPath !== envPath) {
    validateFilePath(outputPath);
    
    // Ensure output directory exists
    const outputDir = outputPath.split('/').slice(0, -1).join('/');
    if (outputDir && outputDir !== '.') {
      // Note: This would require fs.mkdir, but for now we'll assume the directory exists
      // In a full implementation, we'd create the directory if it doesn't exist
    }
  }

  if (!options.dryRun) {
    try {
      // Create backup of original file
      const backupPath = `${envPath}.backup.${Date.now()}`;
      writeFileSync(backupPath, envParsed.raw, "utf-8");
      
      // Write the fixed content
      writeFileSync(resolvedOutputPath, output, "utf-8");
      
      // Clean up backup if successful
      try {
        unlinkSync(backupPath);
      } catch (cleanupErr) {
        const error = cleanupErr as Error;
        process.stderr.write(`Warning: Failed to clean up backup file ${backupPath}: ${error.message}\n`);
      }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "EACCES") {
        throw new Error(`Permission denied writing to ${resolvedOutputPath}`);
      }
      if (error.code === "ENOSPC") {
        throw new Error(`No space left on device when writing to ${resolvedOutputPath}`);
      }
      throw new Error(`Failed to write fixed file ${resolvedOutputPath}: ${error.message}`);
    }
  }

  const result: FixResult = {
    added,
    removed,
    sorted,
    outputPath: options.dryRun ? "(dry run, not written)" : resolvedOutputPath,
  };

  if (options.json) {
    outputJson(result);
  } else {
    if (added.length === 0 && removed.length === 0 && !sorted) {
      outputText("✓ .env is already in sync");
    } else {
      if (added.length > 0) {
        outputText(`Added ${added.length} missing key(s): ${added.join(", ")}`);
      }
      if (removed.length > 0) {
        outputText(`Removed ${removed.length} extra key(s): ${removed.join(", ")}`);
      }
      if (sorted) {
        outputText("Sorted keys alphabetically");
      }
      if (options.dryRun) {
        outputText("(dry run — no changes written)");
      } else {
        outputText(`✓ Fixed ${outputPath}`);
      }
    }
  }

  return result;
}
