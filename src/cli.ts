#!/usr/bin/env node
import { execSync } from 'node:child_process';
import path from 'node:path';

import { BarrelReaperArgs } from '@barrelreaper/src/types';
import { logo } from './logo';
import { Prompt } from './prompt';
import { BarrelReaper } from './reaper';
import { Repl } from './repl';
import { Std } from './std';

const flags: Record<string, keyof BarrelReaperArgs> = {
    '--barrel-file': 'barrelFile',
    '-b': 'barrelFile',
    '--barrel-alias': 'barrelAlias',
    '-a': 'barrelAlias',
    '--reaper-glob': 'reaperGlob',
    '-g': 'reaperGlob',
    '--no-format': 'noFormat',
    '-n': 'noFormat',
    '--dry-run': 'dryRun',
    '-d': 'dryRun',
};

const parseArgs = (argv: string[]): Partial<BarrelReaperArgs> => {
    const args: Partial<BarrelReaperArgs> = {};

    for (let idx = 0; idx < argv.length; idx++) {
        const flag = argv[idx] as keyof typeof flags;
        const key = flags?.[flag];
        if (!key) throw new Error(`Unknown argument: ${flag}`);

        if (key === 'noFormat' || key === 'dryRun') args[key] = true;
        else {
            const value = argv[idx + 1];
            if (!value || value.startsWith('-')) throw new Error(`Missing value for ${flag}`);
            args[key] = value;
            idx++;
        }
    }

    return args;
};

const showHelp = () => {
    Std.writeLine('\x1b[37m');
    Std.writeLine('Usage: barrel-reaper [options]');
    Std.writeLine('');
    Std.writeLine('Direct mode (provide all required flags):');
    Std.writeLine('  -b, --barrel-file    Path to the barrel file relative to git root');
    Std.writeLine('  -g, --reaper-glob    Glob sub-pattern specifying where to search for barrel imports');
    Std.writeLine('');
    Std.writeLine('Optional arguments:');
    Std.writeLine('  -a, --barrel-alias   Import alias used to reference the barrel file in code');
    Std.writeLine('  -n, --no-format      Skip automatic Prettier code formatting');
    Std.writeLine('  -d, --dry-run        Preview changes without modifying files');
    Std.writeLine('');
    Std.writeLine('Interactive mode:');
    Std.writeLine('  Run without required flags to enter step-by-step configuration');
    Std.writeLine('');
    Std.writeLine('Examples:');
    Std.writeLine('  barrel-reaper  # Interactive mode');
    Std.writeLine('  barrel-reaper --barrel-file src/barrel/index.ts --reaper-glob "src/**"');
    Std.writeLine('  barrel-reaper -b src/barrel/index.ts -a @barrel -g "src/**"');
    Std.writeLine('\x1b[0m');
    process.exit(0);
};

const hasRequiredFlags = (args: Partial<BarrelReaperArgs>): args is BarrelReaperArgs => {
    return !!(args.barrelFile?.trim() && args.reaperGlob?.trim());
};

const runReaper = async (args: BarrelReaperArgs, rootDir: string, prompt: Prompt): Promise<boolean> => {
    const reaper = new BarrelReaper({
        barrelAlias: args.barrelAlias,
        barrelFile: path.join(rootDir, args.barrelFile),
        dryRun: args.dryRun ?? false,
        noFormat: args.noFormat ?? false,
        reaperGlob: args.reaperGlob,
        rootDir,
    });

    await reaper.prepare();

    if (!(await prompt.confirm('Scavenge barrel imports?'))) {
        Std.info('Operation cancelled');
        return false;
    }

    await reaper.reap();
    Std.success('Barrel reaping completed!');

    return true;
};

const runDirect = async (args: BarrelReaperArgs, rootDir: string) => {
    const prompt = new Prompt();
    await runReaper(args, rootDir, prompt).finally(() => prompt.close());
};

const runInteractive = async (rootDir: string, repl: Repl): Promise<void> => {
    while (true) {
        try {
            const args = await repl.collectConfiguration();
            if (!(await runReaper(args, rootDir, repl))) break;
            if (!(await repl.confirm('Continue?'))) break;
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            Std.error(error);
            if (!(await repl.confirm('Would you like to try again?', '\x1b[33m'))) break;
            Std.writeLine('');
        }
    }
};

const main = async (): Promise<void> => {
    const rootDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const cmdArgs = process.argv.slice(2);
    if (cmdArgs.includes('--help') || cmdArgs.includes('-h')) showHelp();

    const args = parseArgs(cmdArgs);
    const directMode = hasRequiredFlags(args);

    if (directMode) return runDirect(args, rootDir);
    else {
        Std.writeLine(logo);
        const repl = new Repl();
        if (cmdArgs.length > 0) Std.warning('Missing required arguments. Entering interactive mode...');
        await runInteractive(rootDir, repl).finally(() => repl.close());
    }
};

main().catch((error) => {
    Std.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
