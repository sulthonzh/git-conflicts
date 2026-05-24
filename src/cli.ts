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
  .version('1.0.0');

program
  .command('resolve', { isDefault: true })
  .description('Resolve all merge conflicts interactively')
  .option('-a, --abort', 'Abort current merge')
  .option('-s, --status', 'Show conflict status only')
  .action(async (options) => {
    const gitOps = new GitOperations();
    const resolver = new ConflictResolver();

    try {
      // Handle abort
      if (options.abort) {
        console.log(chalk.yellow('🛑 Aborting merge...'));
        await gitOps.abortMerge();
        console.log(chalk.green('✅ Merge aborted'));
        return;
      }

      // Handle status
      if (options.status) {
        await showStatus(gitOps);
        return;
      }

      // Default: Resolve conflicts
      await resolveConflicts(gitOps, resolver);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    }
  });

async function showStatus(gitOps: GitOperations): Promise<void> {
  try {
    const files = await gitOps.getConflictedFiles();

    if (files.length === 0) {
      console.log(chalk.green('✅ No merge conflicts found'));
      return;
    }

    const branchInfo = await gitOps.getMergeInfo();

    console.log(chalk.red(`🔥 Found ${files.length} merge conflict(s)`));
    console.log(chalk.gray(`📁 ${process.cwd()} (${branchInfo.current})`));
    console.log('');

    files.forEach((file, index) => {
      console.log(chalk.yellow(`${index + 1}. ${file}`));
    });

    console.log('');
    console.log(chalk.blue('Run "git-conflicts" to start resolving'));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
}

async function resolveConflicts(gitOps: GitOperations, resolver: ConflictResolver): Promise<void> {
  try {
    const files = await gitOps.getConflictedFiles();

    if (files.length === 0) {
      console.log(chalk.green('✅ No merge conflicts found'));
      return;
    }

    const branchInfo = await gitOps.getMergeInfo();
    const progress = new ProgressTracker(files.length);

    console.log(chalk.red(`🔥 Found ${files.length} merge conflict(s)`));
    console.log(chalk.gray(`📁 ${process.cwd()} (${branchInfo.current})`));
    console.log('');

    let resolvedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      console.log(chalk.cyan(`📄 Resolving: ${file}`));

      const result = await resolver.resolveFile(file);

      if (result.success) {
        resolvedCount++;
        progress.increment();
        const prog = progress.getProgress();
        console.log(chalk.green(`${result.message} (${prog.current}/${prog.total})`));
      } else {
        failedCount++;
        console.log(chalk.yellow(result.message));
        console.log(chalk.gray('Skipping to next file...'));
      }

      console.log('');
    }

    // Summary
    console.log(chalk.bold('--- Summary ---'));
    console.log(chalk.green(`✅ Resolved: ${resolvedCount}`));
    if (failedCount > 0) {
      console.log(chalk.yellow(`⚠️  Failed/Skipped: ${failedCount}`));
    }

    if (failedCount === 0) {
      console.log('');
      console.log(chalk.green('🎉 All conflicts resolved!'));
      console.log(chalk.blue('Run "git commit" to complete the merge.'));
    } else {
      console.log('');
      console.log(chalk.yellow('Some files still have conflicts or failed to resolve.'));
      console.log(chalk.blue('Run "git-conflicts --status" to check remaining conflicts.'));
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
}

program.parse();