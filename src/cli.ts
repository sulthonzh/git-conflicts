#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { GitOperations } from './git';
import { ProgressTracker } from './progress';
import { ConflictResolver } from './resolver';

const program = new Command();

program
  .name('git-conflicts')
  .description('Interactive CLI to list and resolve merge conflicts')
  .version('1.1.0');

program
  .command('resolve', { isDefault: true })
  .description('Resolve all merge conflicts interactively')
  .option('-a, --abort', 'Abort current merge')
  .option('-s, --status', 'Show conflict status only')
  .option('--stage', 'Auto-stage resolved files with git add')
  .option('-j, --json', 'Output in JSON format (for scripting/CI)')
  .action(async (options) => {
    const gitOps = new GitOperations();
    const resolver = new ConflictResolver();

    try {
      // Handle abort
      if (options.abort) {
        if (options.json) {
          await gitOps.abortMerge();
          console.log(JSON.stringify({ action: 'abort', success: true }));
        } else {
          console.log(chalk.yellow('🛑 Aborting merge...'));
          await gitOps.abortMerge();
          console.log(chalk.green('✅ Merge aborted'));
        }
        return;
      }

      // Handle status
      if (options.status) {
        await showStatus(gitOps, options.json);
        return;
      }

      // Default: Resolve conflicts
      await resolveConflicts(gitOps, resolver, options);
    } catch (error) {
      if (error instanceof Error) {
        if (options.json) {
          console.log(JSON.stringify({ error: error.message }));
          process.exit(1);
        }
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    }
  });

async function showStatus(gitOps: GitOperations, jsonMode: boolean): Promise<void> {
  try {
    const status = await gitOps.getConflictStatus();

    if (jsonMode) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (!status.hasConflicts) {
      console.log(chalk.green('✅ No merge conflicts found'));
      return;
    }

    console.log(chalk.red(`🔥 Found ${status.files.length} merge conflict(s)`));
    console.log(chalk.gray(`📁 ${process.cwd()} (${status.branch})`));
    if (status.merging) {
      console.log(chalk.gray(`🔀 Merging: ${status.merging}`));
    }
    console.log('');

    status.files.forEach((file, index) => {
      console.log(chalk.yellow(`  ${index + 1}. ${file}`));
    });

    console.log('');
    console.log(chalk.blue('Run "git-conflicts" to start resolving'));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
}

async function resolveConflicts(
  gitOps: GitOperations,
  resolver: ConflictResolver,
  options: { json?: boolean; stage?: boolean }
): Promise<void> {
  try {
    const status = await gitOps.getConflictStatus();

    if (!status.hasConflicts) {
      if (options.json) {
        console.log(JSON.stringify({ resolved: 0, failed: 0, message: 'No conflicts found' }));
      } else {
        console.log(chalk.green('✅ No merge conflicts found'));
      }
      return;
    }

    if (options.json) {
      // JSON mode: just report status, don't open editors
      console.log(JSON.stringify({
        action: 'resolve',
        conflicts: status.files,
        branch: status.branch,
        merging: status.merging,
        message: `${status.files.length} conflict(s) found. Use interactive mode (without --json) to resolve.`,
      }));
      return;
    }

    const progress = new ProgressTracker(status.files.length);

    console.log(chalk.red(`🔥 Found ${status.files.length} merge conflict(s)`));
    console.log(chalk.gray(`📁 ${process.cwd()} (${status.branch})`));
    if (status.merging) {
      console.log(chalk.gray(`🔀 Merging: ${status.merging}`));
    }
    console.log('');

    let resolvedCount = 0;
    let failedCount = 0;
    const failedFiles: string[] = [];

    for (const file of status.files) {
      const conflictCount = await resolver.getConflictCount(file);
      console.log(chalk.cyan(`📄 ${file}`) + chalk.gray(` (${conflictCount} conflict${conflictCount !== 1 ? 's' : ''})`));

      const result = await resolver.resolveFile(file);

      if (result.success) {
        resolvedCount++;
        progress.increment();
        const prog = progress.getProgress();

        if (options.stage) {
          try {
            await gitOps.stageFile(file);
            console.log(chalk.green(`  ✅ Resolved & staged ${file} (${prog.current}/${prog.total})`));
          } catch {
            console.log(chalk.green(`  ✅ Resolved ${file} (${prog.current}/${prog.total})`) + chalk.gray(' (staging failed)'));
          }
        } else {
          console.log(chalk.green(`  ✅ Resolved ${file} (${prog.current}/${prog.total})`));
        }
      } else {
        failedCount++;
        failedFiles.push(file);
        console.log(chalk.yellow(`  ${result.message}`));
        console.log(chalk.gray('  Skipping to next file...'));
      }

      console.log('');
    }

    // Summary
    console.log(chalk.bold('── Summary ──'));
    console.log(chalk.green(`  Resolved: ${resolvedCount}/${status.files.length}`));
    if (failedCount > 0) {
      console.log(chalk.yellow(`  Skipped: ${failedCount}`));
      console.log(chalk.gray(`  Files: ${failedFiles.join(', ')}`));
    }

    if (failedCount === 0) {
      console.log('');
      console.log(chalk.green('🎉 All conflicts resolved!'));
      if (options.stage) {
        console.log(chalk.blue('All resolved files staged. Run "git commit" to complete the merge.'));
      } else {
        console.log(chalk.blue('Run "git add ." then "git commit" to complete the merge.'));
      }
    } else {
      console.log('');
      console.log(chalk.yellow('Some files still have conflicts.'));
      console.log(chalk.blue('Run "git-conflicts --status" to check remaining conflicts.'));
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
}

program.parse();
