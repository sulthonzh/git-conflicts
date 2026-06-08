import { Command } from "commander";
import { resolve } from "path";
import { runCheck } from "./commands/check.js";
import { runDiff } from "./commands/diff.js";
import { runSecrets } from "./commands/secrets.js";
import { runInit } from "./commands/init.js";
import { runValidate } from "./commands/validate.js";
import { runFix } from "./commands/fix.js";

const program = new Command();

program
  .name("envguard")
  .description("🔒 Validate .env files, detect secrets, keep env configs in sync")
  .version("1.1.0");

program
  .command("check")
  .description("Validate .env against .env.example")
  .argument("[env]", "path to .env file", ".env")
  .argument("[example]", "path to .env.example file", ".env.example")
  .option("--json", "output as JSON")
  .option("--strict", "fail on extra keys and all empty values")
  .action((env, example, opts) => {
    try {
      const result = runCheck(resolve(env), resolve(example), { json: opts.json, strict: opts.strict });
      process.exit(result.clean ? 0 : 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command("diff")
  .description("Show differences between .env and .env.example")
  .argument("[env]", "path to .env file", ".env")
  .argument("[example]", "path to .env.example file", ".env.example")
  .option("--json", "output as JSON")
  .action((env, example, opts) => {
    try {
      runDiff(resolve(env), resolve(example), { json: opts.json });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command("secrets")
  .description("Scan .env file for leaked secrets")
  .argument("[env]", "path to .env file", ".env")
  .option("--json", "output as JSON")
  .action((env, opts) => {
    try {
      const result = runSecrets(resolve(env), { json: opts.json });
      process.exit(result.hasSecrets ? 1 : 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Generate .env.example from .env")
  .argument("[env]", "path to .env file", ".env")
  .option("-o, --output <path>", "output file path")
  .option("--json", "output as JSON")
  .action((env, opts) => {
    try {
      runInit(resolve(env), { json: opts.json, output: opts.output });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command("validate")
  .description("Full validation: check + type validation")
  .argument("[env]", "path to .env file", ".env")
  .argument("[example]", "path to .env.example file", ".env.example")
  .option("--json", "output as JSON")
  .action((env, example, opts) => {
    try {
      const result = runValidate(resolve(env), resolve(example), { json: opts.json });
      process.exit(result.valid ? 0 : 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program
  .command("fix")
  .description("Sync .env with .env.example — add missing keys, optionally prune extras")
  .argument("[env]", "path to .env file", ".env")
  .argument("[example]", "path to .env.example file", ".env.example")
  .option("--prune", "remove keys not in .env.example")
  .option("--sort", "sort keys alphabetically")
  .option("--dry-run", "show changes without writing")
  .option("-o, --output <path>", "output file path")
  .option("--json", "output as JSON")
  .action((env, example, opts) => {
    try {
      runFix(resolve(env), resolve(example), {
        json: opts.json,
        prune: opts.prune,
        sort: opts.sort,
        dryRun: opts.dryRun,
        output: opts.output,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program.parse();
