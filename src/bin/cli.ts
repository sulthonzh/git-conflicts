#!/usr/bin/env node

import { Command } from 'commander';
import { GitOperations } from '../git.js';
import { ConflictResolver } from '../resolver.js';
import { ProgressTracker } from '../progress.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('git-conflicts')
  .description('Interactive CLI to list and resolve merge conflicts one file at a time with progress tracking')
  .version('1.1.0');

program
  .command('status')
  .description('Show conflict status')
  .action(async () => {
    try {
      const gitOps = new GitOperations();
      const status = await gitOps.getConflictStatus();
      
      if (status.hasConflicts) {
        console.log(chalk.red(`🔥 Found ${status.files.length} merge conflict(s)`));
        console.log(chalk.blue(`📁 ${process.cwd()} (${status.branch})`));
        
        if (status.merging) {
          console.log(chalk.yellow(`🔄 Merging: ${status.merging}`));
        }
        
        if (status.mergeMessage) {
          console.log(chalk.gray(`💬 ${status.mergeMessage}`));
        }
        
        status.files.forEach((file: string, index: number) => {
          console.log(`${index + 1}. ${file}`);
        });
      } else {
        console.log(chalk.green('✅ No merge conflicts found'));
        
        if (status.mergeState !== 'none') {
          console.log(chalk.blue(`🔄 ${status.mergeState} in progress on branch ${status.branch}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('abort')
  .description('Abort current merge')
  .action(async () => {
    try {
      const gitOps = new GitOperations();
      
      console.log(chalk.yellow('🔄 Aborting current merge...'));
      await gitOps.abortMerge();
      console.log(chalk.green('✅ Merge aborted successfully'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not in a merge state')) {
        console.log(chalk.green('✅ Not in a merge state'));
      } else {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }
  });

program
  .command('resolve')
  .description('Resolve all conflicts interactively')
  .alias('r')
  .action(async () => {
    try {
      const gitOps = new GitOperations();
      const resolver = new ConflictResolver(gitOps);
      const progress = new ProgressTracker(0);
      
      const status = await gitOps.getConflictStatus();
      
      if (!status.hasConflicts) {
        console.log(chalk.green('✅ No conflicts to resolve'));
        return;
      }
      
      console.log(chalk.red(`🔥 Found ${status.files.length} merge conflict(s)`));
      console.log(chalk.blue(`📁 ${process.cwd()} (${status.branch})`));
      
      if (status.merging) {
        console.log(chalk.yellow(`🔄 Merging: ${status.merging}`));
      }
      
      (progress as any).total = status.files.length;
      
      for (let i = 0; i < status.files.length; i++) {
        const file = status.files[i];
        const currentProgress = progress.getProgress();
        
        console.log(`\n${chalk.blue(`📄 Resolving: ${file}`)} (${currentProgress.current}/${currentProgress.total})`);
        
        try {
          const result = await resolver.resolveFile(file);
          
          if (result.success) {
            console.log(chalk.green(`✅ ${result.message}`));
            progress.increment();
          } else {
            console.log(chalk.red(`❌ ${result.message}`));
            console.log(chalk.yellow('⏭️  Skipping this file...'));
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error resolving ${file}:`), error instanceof Error ? error.message : String(error));
          console.log(chalk.yellow('⏭️  Skipping this file...'));
        }
      }
      
      const finalProgress = progress.getProgress();
      
      console.log('\n--- Summary ---');
      console.log(chalk.green(`✅ Resolved: ${finalProgress.current}`));
      console.log(chalk.yellow(`❌ Skipped: ${status.files.length - finalProgress.current}`));
      
      if (progress.isComplete()) {
        console.log(chalk.green('\n🎉 All conflicts resolved!'));
        console.log(chalk.blue('Run "git commit" to complete the merge.'));
      } else {
        console.log(chalk.yellow('\n⚠️  Some conflicts remain. Resolve them manually or run again.'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();