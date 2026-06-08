import { readFileSync } from "fs";
import { resolve } from "path";

export interface EnvEntry {
  key: string;
  value: string;
  line: number;
  comment?: string;
  raw: string;
}

export interface EnvComment {
  text: string;
  line: number;
  raw: string;
}

export interface ParsedEnv {
  entries: EnvEntry[];
  comments: EnvComment[];
  raw: string;
}

/** Validate a file path to prevent path traversal attacks. */
export function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File path must be a non-empty string");
  }

  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  // Basic validation
  if (normalized.length === 0 || normalized.length > 4096) {
    throw new Error("File path must be between 1 and 4096 characters");
  }

  // Reject null bytes and other control characters
  if (normalized.includes("\0") || /\x00|\x01|\x02|\x03|\x04|\x05|\x06|\x07|\x08|\x0b|\x0c|\x0e|\x0f|\x10|\x11|\x12|\x13|\x14|\x15|\x16|\x17|\x18|\x19|\x1a|\x1b|\x1c|\x1d|\x1e|\x1f/.test(normalized)) {
    throw new Error("File path contains invalid characters");
  }

  // Reject path traversal attempts
  if (normalized.includes("..") || normalized.includes("~") || normalized.includes("//") || normalized.includes("/./")) {
    throw new Error(`Invalid file path: path traversal detected in "${filePath}"`);
  }

  // Reject attempts to escape current directory
  if (normalized.startsWith("/") && !normalized.startsWith(process.cwd() + "/")) {
    throw new Error(`Invalid file path: absolute paths outside current working directory are not allowed`);
  }

  // Resolve the path to check for symlinks
  const resolvedPath = resolve(normalized);
  const cwd = process.cwd();
  
  // Check if resolved path is within current working directory
  if (!resolvedPath.startsWith(cwd + "/") && resolvedPath !== cwd) {
    throw new Error(`Invalid file path: "${filePath}" resolves to outside current working directory`);
  }

  // Additional check for symlinks that might point outside
  try {
    const stats = require("fs").statSync(resolvedPath);
    if (stats.isSymbolicLink()) {
      const realPath = require("fs").realpathSync(resolvedPath);
      if (!realPath.startsWith(cwd + "/") && realPath !== cwd) {
        throw new Error(`Invalid file path: symlink "${filePath}" points outside current working directory`);
      }
    }
  } catch (err) {
    // If we can't resolve the symlink, reject it
    throw new Error(`Invalid file path: cannot resolve symlink "${filePath}"`);
  }

  return filePath;
}

/** Strip BOM if present. */
function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

/**
 * Parse a .env file content into structured entries.
 */
export function parseEnvContent(content: string): ParsedEnv {
  const raw = stripBOM(content);
  const lines = raw.split(/\r?\n/);
  const entries: EnvEntry[] = [];
  const comments: EnvComment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Empty line
    if (line.trim() === "") {
      continue;
    }

    // Comment line
    if (line.trimStart().startsWith("#")) {
      comments.push({
        text: line.trimStart().slice(1).trim(),
        line: lineNumber,
        raw: line,
      });
      continue;
    }

    // Strip "export " prefix
    let cleaned = line.trimStart();
    if (cleaned.startsWith("export ")) {
      cleaned = cleaned.slice(7);
    }

    // Parse key=value
    const equalIndex = cleaned.indexOf("=");
    if (equalIndex === -1) {
      // Key without value — treat as empty
      entries.push({
        key: cleaned.trim(),
        value: "",
        line: lineNumber,
        raw: line,
      });
      continue;
    }

    const key = cleaned.slice(0, equalIndex).trim();
    let value = cleaned.slice(equalIndex + 1);

    // Handle quoted values
    value = value.trim();
    let quoteChar: string | null = null;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      quoteChar = value[0];
      value = value.slice(1, -1);

      // Unescape basic sequences in double quotes
      if (quoteChar === '"') {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\"/g, '"');
      }
    } else {
      // Unquoted: strip inline comment
      const inlineCommentMatch = value.match(/\s+#\s/);
      if (inlineCommentMatch) {
        value = value.slice(0, inlineCommentMatch.index!).trim();
      }
    }

    entries.push({
      key,
      value,
      line: lineNumber,
      raw: line,
    });
  }

  return { entries, comments, raw };
}

/** Parse an env file from disk. */
export function parseEnvFile(filePath: string): ParsedEnv {
  const validated = validateFilePath(filePath);
  const fullPath = resolve(validated);

  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`File not found: ${fullPath}`);
    }
    if (error.code === "EACCES") {
      throw new Error(`Permission denied: ${fullPath}`);
    }
    throw new Error(`Failed to read file ${fullPath}: ${error.message}`);
  }

  return parseEnvContent(content);
}

/** Get a Map of key→value from parsed env. */
export function toEnvMap(parsed: ParsedEnv): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of parsed.entries) {
    map.set(entry.key, entry.value);
  }
  return map;
}

/** Get a Map of key→comment annotations from .env.example content. */
export function extractAnnotations(
  content: string
): Map<string, { required: boolean; type: string | null; defaultValue: string }> {
  const parsed = parseEnvContent(content);
  const annotations = new Map<string, { required: boolean; type: string | null; defaultValue: string }>();

  for (const entry of parsed.entries) {
    // Look at the raw line for inline annotations like: KEY=value # @required @type url
    const rawAfterKey = entry.raw.slice(entry.raw.indexOf("=") + 1);
    const annotationPart = rawAfterKey;

    const required = /@required/i.test(annotationPart);
    const typeMatch = annotationPart.match(/@type\s+(\w+)/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : null;

    annotations.set(entry.key, {
      required,
      type,
      defaultValue: entry.value,
    });
  }

  return annotations;
}
