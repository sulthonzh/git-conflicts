import { readFileSync, statSync, realpathSync } from "fs";
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

  // Resolve the path to check if it's within current working directory
  const resolvedPath = resolve(normalized);
  const cwd = process.cwd();
  
  // Check if resolved path is within current working directory (exact match or proper subdirectory)
  const isInCwd = resolvedPath === cwd || resolvedPath.startsWith(cwd + "/");
  if (!isInCwd) {
    throw new Error(`Invalid file path: "${filePath}" resolves to outside current working directory`);
  }

  return filePath;
}

/** Validate and resolve a file path, checking if it exists. */
export function validateAndResolveFile(filePath: string): string {
  const validated = validateFilePath(filePath);
  const resolvedPath = resolve(validated);
  
  try {
    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: "${filePath}"`);
    }
    return resolvedPath;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`File not found: "${filePath}"`);
    }
    if (error.code === "EACCES") {
      throw new Error(`Permission denied: "${filePath}"`);
    }
    throw new Error(`Cannot access file "${filePath}": ${error.message}`);
  }
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
  // Validate input size to prevent DoS attacks
  if (content && content.length > 1024 * 1024) { // 1MB limit
    throw new Error("Content too large (max 1MB)");
  }
  
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
      // Key without value — treat as empty, but validate key name
      const key = cleaned.trim();
      if (key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        entries.push({
          key,
          value: "",
          line: lineNumber,
          raw: line,
        });
      }
      continue;
    }

    const key = cleaned.slice(0, equalIndex).trim();
    // Validate key name (must be valid identifier)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      // Skip invalid entries but continue processing
      continue;
    }
    
    let value = cleaned.slice(equalIndex + 1);

    // Handle quoted values
    value = value.trim();
    let quoteChar: string | null = null;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      quoteChar = value[0];
      value = value.slice(1, -1);

      // Enhanced unescape with protection against escape sequence injection
      if (quoteChar === '"') {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\"/g, '"')
          // Remove other escape sequences that could be dangerous
          .replace(/\\[a-zA-Z]/g, '');
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
  const fullPath = validateAndResolveFile(filePath);
  
  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
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
  if (!content || typeof content !== "string") {
    throw new Error("Content must be a non-empty string");
  }

  if (content.length > 1024 * 1024) { // 1MB limit
    throw new Error("Content too large (max 1MB)");
  }

  const parsed = parseEnvContent(content);
  const annotations = new Map<string, { required: boolean; type: string | null; defaultValue: string }>();

  for (const entry of parsed.entries) {
    // Look at the raw line for inline annotations like: KEY=value # @required @type url
    // But skip annotations inside quoted values — only look at content after the value portion.
    const rawAfterKey = entry.raw.slice(entry.raw.indexOf("=") + 1);
    let annotationPart = rawAfterKey;

    // If the value is quoted, strip the quoted portion before looking for annotations
    const trimmedAfterKey = rawAfterKey.trimStart();
    if (trimmedAfterKey.startsWith('"')) {
      const closingQuote = rawAfterKey.indexOf('"', 1);
      if (closingQuote !== -1) {
        annotationPart = rawAfterKey.slice(closingQuote + 1);
      }
    } else if (trimmedAfterKey.startsWith("'")) {
      const closingQuote = rawAfterKey.indexOf("'", 1);
      if (closingQuote !== -1) {
        annotationPart = rawAfterKey.slice(closingQuote + 1);
      }
    }

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
