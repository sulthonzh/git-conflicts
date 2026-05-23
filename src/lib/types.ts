/**
 * Type validation — validates env values against type annotations.
 *
 * Supported types: string, number, boolean, url, email, json, port
 */

export type EnvType = "string" | "number" | "boolean" | "url" | "email" | "json" | "port";

export interface TypeViolation {
  key: string;
  expectedType: EnvType;
  actualValue: string;
  message: string;
}

const VALID_TYPES = new Set<string>(["string", "number", "boolean", "url", "email", "json", "port"]);

/** Check if a type string is recognized. */
export function isValidType(type: string): type is EnvType {
  return VALID_TYPES.has(type.toLowerCase());
}

/** Validate a single value against a type. */
export function validateType(value: string, type: EnvType): string | null {
  switch (type) {
    case "string":
      // Any non-empty string is valid
      return value.length > 0 ? null : "expected non-empty string";

    case "number": {
      if (value.trim() === "") return "expected a number";
      const num = Number(value);
      if (Number.isNaN(num)) return `expected a number, got "${value}"`;
      return null;
    }

    case "boolean":
      if (["true", "false", "1", "0", "yes", "no"].includes(value.toLowerCase())) {
        return null;
      }
      return `expected boolean (true/false/1/0/yes/no), got "${value}"`;

    case "url":
      try {
        new URL(value);
        return null;
      } catch {
        return `expected a valid URL, got "${value}"`;
      }

    case "email": {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value)) return null;
      return `expected a valid email, got "${value}"`;
    }

    case "json":
      try {
        JSON.parse(value);
        return null;
      } catch {
        return `expected valid JSON, got "${value}"`;
      }

    case "port": {
      const port = Number(value);
      if (Number.isNaN(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
        return `expected a valid port (1-65535), got "${value}"`;
      }
      return null;
    }

    default:
      return `unknown type: ${type}`;
  }
}

/** Validate multiple values against type annotations. */
export function validateTypes(
  values: Map<string, string>,
  typeAnnotations: Map<string, string | null>
): TypeViolation[] {
  const violations: TypeViolation[] = [];

  for (const [key, typeStr] of typeAnnotations) {
    if (!typeStr || !isValidType(typeStr)) continue;

    const value = values.get(key);
    if (value === undefined || value === "") continue; // skip missing/empty

    const envType = typeStr.toLowerCase() as EnvType;
    const error = validateType(value, envType);
    if (error) {
      violations.push({
        key,
        expectedType: envType,
        actualValue: value,
        message: error,
      });
    }
  }

  return violations;
}
