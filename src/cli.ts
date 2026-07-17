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
  .version('0.0.40');

program
  .command('resolve', { isDefault: true })
  .description('Resolve all merge conflicts interactively')
  .option('-a, --abort', 'Abort current merge')
  .option('-s, --status', 'Show conflict status only')
  .option('--stage', 'Auto-stage resolved files with git add')
  .option('-j, --json', 'Output in JSON format (for scripting/CI)')
  .option('--cwd <path>', 'Path to git repository (defaults to current directory)')
  .action(async (options) => {
    const gitOps = new GitOperations(options.cwd);
    const resolver = new ConflictResolver(gitOps);

    try {
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

      if (options.status) {
        await showStatus(gitOps, options.json);
        return;
      }

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

export async function showStatus(gitOps: GitOperations, jsonMode: boolean): Promise<void> {
  try {
    const status = await gitOps.getConflictStatus();

    if (jsonMode) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (!status.hasConflicts) {
      const mergeState = await gitOps.getMergeState();
      if (mergeState !== 'none' && mergeState !== 'unknown') {
        console.log(chalk.yellow(`🔀 ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
        console.log(chalk.gray('Run git-conflicts to continue resolving conflicts'));
      } else {
        console.log(chalk.green('✅ No merge conflicts found'));
      }
      return;
    }

    console.log(chalk.red(`🔥 Found ${status.files.length} merge conflict(s)`));
    console.log(chalk.gray(`📁 ${process.cwd()} (${status.branch})`));
    if (status.merging) {
      console.log(chalk.gray(`🔀 Merging: ${status.merging}`));
    }
    
    const mergeState = status.mergeState;
    if (mergeState && mergeState !== 'none') {
      console.log(chalk.gray(`📋 Status: ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
    }
    console.log('');

    status.files.forEach((file, index) => {
      console.log(chalk.yellow(`  ${index + 1}. ${file}`));
    });

    console.log('');
    console.log(chalk.blue('Run "git-conflicts" to start resolving'));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
    throw error;
  }
}

export async function resolveConflicts(
  gitOps: GitOperations,
  resolver: ConflictResolver,
  options: { json?: boolean; stage?: boolean }
): Promise<void> {
  try {
    const status = await gitOps.getConflictStatus();

    if (!status.hasConflicts) {
      const mergeState = await gitOps.getMergeState();
      if (mergeState !== 'none' && mergeState !== 'unknown') {
        if (options.json) {
          console.log(JSON.stringify({
            resolved: 0, 
            failed: 0, 
            message: `${mergeState} in progress, no conflicts to resolve`
          }));
        } else {
          console.log(chalk.yellow(`🔀 ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
          console.log(chalk.gray('No conflicts to resolve yet.'));
        }
      } else {
        if (options.json) {
          console.log(JSON.stringify({ resolved: 0, failed: 0, message: 'No conflicts found' }));
        } else {
          console.log(chalk.green('✅ No merge conflicts found'));
        }
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
        mergeState: status.mergeState,
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
    
    const mergeState = status.mergeState;
    if (mergeState && mergeState !== 'none') {
      console.log(chalk.gray(`📋 Status: ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
    }
    console.log('');

    let resolvedCount = 0;
    let failedCount = 0;
    const failedFiles: string[] = [];
    const oversizedFiles: string[] = [];

    for (const file of status.files) {
      const conflictCount = await resolver.getConflictCount(file);
      
      if (conflictCount === -1) {
        oversizedFiles.push(file);
        console.log(chalk.yellow(`⚠️  ${file} (file too large, skipped)`));
        console.log(chalk.gray('  Skipping to next file...'));
        failedCount++;
        failedFiles.push(file);
        console.log('');
        continue;
      }
      
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
    
    if (oversizedFiles.length > 0) {
      console.log(chalk.yellow(`  Oversized (skipped): ${oversizedFiles.length}`));
      console.log(chalk.gray(`  Max file size: 10MB`));
    }
    
    if (failedCount > oversizedFiles.length) {
      const actualFailed = failedCount - oversizedFiles.length;
      console.log(chalk.yellow(`  Skipped: ${actualFailed}`));
    }
    
    if (failedFiles.length > 0) {
      const displayFiles = oversizedFiles.length > 0 
        ? [...failedFiles] 
        : failedFiles.filter(f => !oversizedFiles.includes(f));
      if (displayFiles.length > 0) {
        console.log(chalk.gray(`  Files: ${displayFiles.join(', ')}`));
      }
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
      if (oversizedFiles.length === failedCount) {
        console.log(chalk.yellow('All remaining files are too large to process.'));
        console.log(chalk.blue('Reduce file sizes or use manual resolution for large files.'));
      } else if (oversizedFiles.length > 0) {
        console.log(chalk.yellow(`Some files (${failedCount - oversizedFiles.length}) still have conflicts.`));
        console.log(chalk.blue('Run "git-conflicts --status" to check remaining conflicts.'));
      } else {
        console.log(chalk.yellow('Some files still have conflicts.'));
        console.log(chalk.blue('Run "git-conflicts --status" to check remaining conflicts.'));
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to resolve conflicts: ${error.message}`);
    }
    throw error;
  }
}

program.parse();
