#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const git_1 = require("./git");
const progress_1 = require("./progress");
const resolver_1 = require("./resolver");
// Maximum file size for conflict resolution (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const program = new commander_1.Command();
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
    .option('--cwd <path>', 'Path to git repository (defaults to current directory)')
    .action(async (options) => {
    const gitOps = new git_1.GitOperations(options.cwd);
    const resolver = new resolver_1.ConflictResolver(gitOps);
    try {
        if (options.abort) {
            if (options.json) {
                await gitOps.abortMerge();
                console.log(JSON.stringify({ action: 'abort', success: true }));
            }
            else {
                console.log(chalk_1.default.yellow('🛑 Aborting merge...'));
                await gitOps.abortMerge();
                console.log(chalk_1.default.green('✅ Merge aborted'));
            }
            return;
        }
        if (options.status) {
            await showStatus(gitOps, options.json);
            return;
        }
        await resolveConflicts(gitOps, resolver, options);
    }
    catch (error) {
        if (error instanceof Error) {
            if (options.json) {
                console.log(JSON.stringify({ error: error.message }));
                process.exit(1);
            }
            console.error(chalk_1.default.red(`❌ Error: ${error.message}`));
            process.exit(1);
        }
    }
});
async function showStatus(gitOps, jsonMode) {
    try {
        const status = await gitOps.getConflictStatus();
        if (jsonMode) {
            console.log(JSON.stringify(status, null, 2));
            return;
        }
        if (!status.hasConflicts) {
            const mergeState = await gitOps.getMergeState();
            if (mergeState !== 'none' && mergeState !== 'unknown') {
                console.log(chalk_1.default.yellow(`🔀 ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
                console.log(chalk_1.default.gray('Run git-conflicts to continue resolving conflicts'));
            }
            else {
                console.log(chalk_1.default.green('✅ No merge conflicts found'));
            }
            return;
        }
        console.log(chalk_1.default.red(`🔥 Found ${status.files.length} merge conflict(s)`));
        console.log(chalk_1.default.gray(`📁 ${process.cwd()} (${status.branch})`));
        if (status.merging) {
            console.log(chalk_1.default.gray(`🔀 Merging: ${status.merging}`));
        }
        const mergeState = status.mergeState;
        if (mergeState && mergeState !== 'none') {
            console.log(chalk_1.default.gray(`📋 Status: ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
        }
        console.log('');
        status.files.forEach((file, index) => {
            console.log(chalk_1.default.yellow(`  ${index + 1}. ${file}`));
        });
        console.log('');
        console.log(chalk_1.default.blue('Run "git-conflicts" to start resolving'));
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get status: ${error.message}`);
        }
        throw error;
    }
}
async function getTotalConflicts(files) {
    let total = 0;
    for (const file of files) {
        try {
            const gitOps = new git_1.GitOperations();
            const count = await gitOps.countConflictsInFile(file);
            if (count > 0)
                total += count;
        }
        catch {
            // Skip files we can't read
        }
    }
    return total;
}
async function resolveConflicts(gitOps, resolver, options) {
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
                }
                else {
                    console.log(chalk_1.default.yellow(`🔀 ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
                    console.log(chalk_1.default.gray('No conflicts to resolve yet.'));
                }
            }
            else {
                if (options.json) {
                    console.log(JSON.stringify({ resolved: 0, failed: 0, message: 'No conflicts found' }));
                }
                else {
                    console.log(chalk_1.default.green('✅ No merge conflicts found'));
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
        const progress = new progress_1.ProgressTracker(status.files.length);
        console.log(chalk_1.default.red(`🔥 Found ${status.files.length} merge conflict(s)`));
        console.log(chalk_1.default.gray(`📁 ${process.cwd()} (${status.branch})`));
        if (status.merging) {
            console.log(chalk_1.default.gray(`🔀 Merging: ${status.merging}`));
        }
        const mergeState = status.mergeState;
        if (mergeState && mergeState !== 'none') {
            console.log(chalk_1.default.gray(`📋 Status: ${mergeState.charAt(0).toUpperCase() + mergeState.slice(1)} in progress`));
        }
        console.log('');
        let resolvedCount = 0;
        let failedCount = 0;
        const failedFiles = [];
        const oversizedFiles = [];
        for (const file of status.files) {
            const conflictCount = await resolver.getConflictCount(file);
            if (conflictCount === -1) {
                oversizedFiles.push(file);
                console.log(chalk_1.default.yellow(`⚠️  ${file} (file too large, skipped)`));
                console.log(chalk_1.default.gray(`  Max file size: ${MAX_FILE_SIZE / 1024 / 1024}MB. Use manual resolution for large files.`));
                failedCount++;
                failedFiles.push(file);
                console.log('');
                continue;
            }
            if (conflictCount === -2) {
                failedFiles.push(file);
                console.log(chalk_1.default.red(`❌ ${file} (unreadable file, skipped)`));
                console.log(chalk_1.default.gray('  The file may be locked, permission denied, or corrupted.'));
                failedCount++;
                console.log('');
                continue;
            }
            console.log(chalk_1.default.cyan(`📄 ${file}`) + chalk_1.default.gray(` (${conflictCount} conflict${conflictCount !== 1 ? 's' : ''})`));
            const result = await resolver.resolveFile(file);
            if (result.success) {
                resolvedCount++;
                progress.increment();
                const prog = progress.getProgress();
                if (options.stage) {
                    try {
                        await gitOps.stageFile(file);
                        console.log(chalk_1.default.green(`  ✅ Resolved & staged ${file} (${prog.current}/${prog.total})`));
                    }
                    catch {
                        console.log(chalk_1.default.green(`  ✅ Resolved ${file} (${prog.current}/${prog.total})`) + chalk_1.default.gray(' (staging failed)'));
                    }
                }
                else {
                    console.log(chalk_1.default.green(`  ✅ Resolved ${file} (${prog.current}/${prog.total})`));
                }
            }
            else {
                failedCount++;
                failedFiles.push(file);
                console.log(chalk_1.default.yellow(`  ${result.message}`));
                // Provide helpful hints for common resolution failures
                if (result.message.includes('conflict markers still present')) {
                    console.log(chalk_1.default.gray('  Tip: Make sure to remove all <<<<<<<, =======, and >>>>>>> markers.'));
                }
                else if (result.message.includes('file does not exist')) {
                    console.log(chalk_1.default.gray('  Tip: The file may have been deleted or moved. Check git status.'));
                }
                else if (result.message.includes('file is empty')) {
                    console.log(chalk_1.default.gray('  Tip: The file appears to be empty after editing. Consider restoring from git.'));
                }
                console.log(chalk_1.default.gray('  Skipping to next file...'));
            }
            console.log('');
        }
        // Summary
        console.log(chalk_1.default.bold('── Summary ──'));
        console.log(chalk_1.default.green(`  Resolved: ${resolvedCount}/${status.files.length}`));
        // Show conflict statistics if available
        if (status.files.length > 0) {
            const totalConflicts = await getTotalConflicts(status.files);
            if (totalConflicts > 0) {
                console.log(chalk_1.default.gray(`  Total conflicts found: ${totalConflicts}`));
                console.log(chalk_1.default.gray(`  Average conflicts per file: ${(totalConflicts / status.files.length).toFixed(1)}`));
            }
        }
        if (oversizedFiles.length > 0) {
            console.log(chalk_1.default.yellow(`  Oversized (skipped): ${oversizedFiles.length}`));
            console.log(chalk_1.default.gray(`  Max file size: ${MAX_FILE_SIZE / 1024 / 1024}MB`));
        }
        const nonOversizedFailed = failedCount - oversizedFiles.length;
        if (nonOversizedFailed > 0) {
            console.log(chalk_1.default.yellow(`  Resolution failed: ${nonOversizedFailed}`));
        }
        if (failedFiles.length > 0) {
            const displayFiles = oversizedFiles.length > 0
                ? [...failedFiles]
                : failedFiles.filter(f => !oversizedFiles.includes(f));
            if (displayFiles.length > 0) {
                console.log(chalk_1.default.gray(`  Files: ${displayFiles.join(', ')}`));
            }
        }
        if (failedCount === 0) {
            console.log('');
            console.log(chalk_1.default.green('🎉 All conflicts resolved!'));
            if (options.stage) {
                console.log(chalk_1.default.blue('All resolved files staged. Run "git commit" to complete the merge.'));
            }
            else {
                console.log(chalk_1.default.blue('Run "git add ." then "git commit" to complete the merge.'));
            }
        }
        else {
            console.log('');
            if (oversizedFiles.length === failedCount) {
                console.log(chalk_1.default.yellow('All remaining files are too large to process.'));
                console.log(chalk_1.default.blue('Reduce file sizes or use manual resolution for large files.'));
            }
            else if (oversizedFiles.length > 0) {
                console.log(chalk_1.default.yellow(`Some files (${failedCount - oversizedFiles.length}) still have conflicts.`));
                console.log(chalk_1.default.blue('Run "git-conflicts --status" to check remaining conflicts.'));
            }
            else {
                console.log(chalk_1.default.yellow('Some files still have conflicts.'));
                console.log(chalk_1.default.blue('Run "git-conflicts --status" to check remaining conflicts.'));
            }
        }
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to resolve conflicts: ${error.message}`);
        }
        throw error;
    }
}
program.parse();
//# sourceMappingURL=cli.js.map