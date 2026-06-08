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
    text?: string;
    key?: string;
  }> = [];

  for (const comment of exampleParsed.comments) {
    allLineItems.push({ line: comment.line, type: "comment", text: comment.text });
  }
  for (const entry of exampleParsed.entries) {
    allLineItems.push({ line: entry.line, type: "entry", key: entry.key });
  }
  allLineItems.sort((a, b) => a.line - b.line);

  for (const item of allLineItems) {
    if (item.type === "comment") {
      fixedLines.push(`# ${item.text}`);
    } else if (item.type === "entry" && item.key) {
      const key = item.key;
      processedKeys.add(key);

      if (envMap.has(key)) {
        // Keep existing value
        fixedLines.push(`${key}=${envMap.get(key)}`);
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
  const commentLines: string[] = [];
  const entryLines: string[] = [];
  let sorted = false;

  if (options.sort) {
    // Separate comments (first block) from entries
    let inHeader = true;
    for (const line of fixedLines) {
      if (line.startsWith("#") && inHeader) {
        commentLines.push(line);
      } else {
        inHeader = false;
        entryLines.push(line);
      }
    }
    entryLines.sort((a, b) => {
      const keyA = a.split("=")[0];
      const keyB = b.split("=")[0];
      return keyA.localeCompare(keyB);
    });
    sorted = true;
  }

  const finalLines = options.sort ? [...commentLines, ...entryLines] : fixedLines;
  const output = finalLines.join("\n") + "\n";

  const outputPath = options.output || envPath;

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
      writeFileSync(outputPath, output, "utf-8");
      
      // Clean up backup if successful
      try {
        unlinkSync(backupPath);
      } catch (cleanupErr) {
        // If cleanup fails, log it but don't fail the operation
        const error = cleanupErr as Error;
        process.stderr.write(`Warning: Failed to clean up backup file ${backupPath}: ${error.message}\n`);
      }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "EACCES") {
        throw new Error(`Permission denied writing to ${outputPath}`);
      }
      if (error.code === "ENOSPC") {
        throw new Error(`No space left on device when writing to ${outputPath}`);
      }
      throw new Error(`Failed to write fixed file ${outputPath}: ${error.message}`);
    }
  }

  const result: FixResult = {
    added,
    removed,
    sorted,
    outputPath: options.dryRun ? "(dry run, not written)" : outputPath,
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
