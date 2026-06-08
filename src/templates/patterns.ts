/**
 * Secret detection patterns for common leaked credentials.
 * All patterns are static regex — no dynamic construction, no ReDoS risk.
 */

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium";
  description: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key ID",
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
    description: "AWS IAM access key identifier",
  },
  {
    name: "AWS Secret Access Key",
    pattern: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key|AwsSecretAccessKey|AWS_SECRET)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/,
    severity: "critical",
    description: "AWS IAM secret access key",
  },
  {
    name: "GitHub Token",
    pattern: /gh[ps]_[A-Za-z0-9_]{36,}/,
    severity: "critical",
    description: "GitHub personal access or OAuth token",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
    severity: "critical",
    description: "PEM-encoded private key",
  },
  {
    name: "JWT",
    pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/,
    severity: "high",
    description: "JSON Web Token",
  },
  {
    name: "Generic API Key",
    pattern: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?key)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i,
    severity: "high",
    description: "Generic API key or secret",
  },
  {
    name: "Generic Token",
    pattern: /(?:token|bearer|auth[_-]?token|session[_-]?token)\s*[=:]\s*['"]?(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9_\-]{32,})['"]?/i,
    severity: "high",
    description: "Generic authentication token",
  },
  {
    name: "Database Connection String",
    pattern: /(?:mysql|postgres|mongodb|redis|cassandra):\/\/[\w.:]+@[^\s\/]+:[0-9]+(?:\/[^\s]*)?/i,
    severity: "critical",
    description: "Database connection string with credentials",
  },
  {
    name: "Service Account Key",
    pattern: /-----BEGIN SERVICE ACCOUNT KEY-----/,
    severity: "critical",
    description: "Google Cloud service account key",
  },
  {
    name: "OAuth Client ID",
    pattern: /[0-9]{19}\.apps\.googleusercontent\.com/,
    severity: "high",
    description: "Google OAuth client ID",
  },
  {
    name: "Slack Webhook",
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{9,}/,
    severity: "high",
    description: "Slack incoming webhook URL",
  },
  {
    name: "OpenAI API Key",
    pattern: /sk-[A-Za-z0-9]{48}/,
    severity: "critical",
    description: "OpenAI API key",
  },
  {
    name: "Google API Key",
    pattern: /AIza[0-9A-Za-z_-]{35}/,
    severity: "high",
    description: "Google API key",
  },
  {
    name: "Stripe Publishable Key",
    pattern: /pk_live_[A-Za-z0-9]{24}/,
    severity: "high",
    description: "Stripe publishable key",
  },
  {
    name: "Slack Webhook Secret",
    pattern: /whsec_[A-Za-z0-9]{32,}/,
    severity: "high",
    description: "Slack webhook secret",
  },
];
