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
      if (!Number.isFinite(num)) return `expected a finite number, got "${value}"`;
      return null;
    }

    case "boolean": {
      const lowerValue = value.toLowerCase();
      if (["true", "false", "1", "0", "yes", "no", "on", "off"].includes(lowerValue)) {
        return null;
      }
      return `expected boolean (true/false/1/0/yes/no/on/off), got "${value}"`;
    }

    case "url": {
      try {
        const url = new URL(value);
        // Allow common protocols including databases and web protocols
        const allowedProtocols = ["http:", "https:", "ftp:", "file:", "postgresql:", "postgres:", "mysql:", "mongodb:", "redis:", "amqp:", "ws:", "wss:"];
        if (!allowedProtocols.includes(url.protocol)) {
          return `expected a valid URL (http/https/ftp/file/postgres/mysql/mongodb/redis/websocket), got "${value}"`;
        }
        // Require hostname for most protocols except file
        if (url.protocol !== "file:" && !url.hostname) {
          return `expected a valid URL with hostname, got "${value}"`;
        }
        return null;
      } catch {
        return `expected a valid URL, got "${value}"`;
      }
    }

    case "email": {
      // More comprehensive email validation
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (emailRegex.test(value)) {
        // Additional validation for common invalid patterns
        const parts = value.split('@');
        if (parts.length === 2) {
          const [local, domain] = parts;
          // Check for consecutive dots in local part
          if (local.includes('..') || local.startsWith('.') || local.endsWith('.')) {
            return `expected a valid email, got "${value}"`;
          }
          // Check for invalid domain patterns
          if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
            return `expected a valid email, got "${value}"`;
          }
          // Check for top-level domain length
          const tld = domain.split('.').pop();
          if (tld && tld.length < 2) {
            return `expected a valid email, got "${value}"`;
          }
        }
        return null;
      }
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
      // Trim whitespace first
      const trimmed = value.trim();
      if (trimmed === "") {
        return "expected a port number";
      }
      
      // Check for leading zeros (except for 0 itself)
      if (trimmed.length > 1 && trimmed.startsWith('0')) {
        return "port numbers cannot have leading zeros";
      }
      
      const port = Number(trimmed);
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
