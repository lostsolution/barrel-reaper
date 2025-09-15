#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import path from 'node:path';

import { BarrelReaperArgs } from '@barrelreaper/src/types';
import { logo } from './logo';
import { BarrelReaper } from './reaper';
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

const parseArgs = (argv: string[]): BarrelReaperArgs => {
    const args: BarrelReaperArgs = { noFormat: false, dryRun: false };

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

const prompt = (question: string): Promise<boolean> => {
    process.stdout.write(`${question} (y/n): `);

    return new Promise((resolve) => {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        const onData = (data: string) => {
            process.stdin.pause();
            process.stdin.removeListener('data', onData);

            /** clear the prompt */
            Std.write('\x1b[1A');
            Std.write('\r\x1b[K');

            const response = data.trim().toLowerCase();
            if (response === 'y' || response === 'yes') resolve(true);
            else resolve(false);
        };

        process.stdin.on('data', onData);
    });
};

const main = async () => {
    Std.writeLine(logo);

    const rootDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const args = parseArgs(process.argv.slice(2));

    if (!args.barrelFile || !args.reaperGlob) {
        Std.writeLine('\x1b[37m');
        Std.writeLine('Usage: barrel-reaper --barrel-file <path> --reaper-glob <glob> [options]');
        Std.writeLine('');
        Std.writeLine('Required arguments:');
        Std.writeLine('  -b, --barrel-file    Path to the barrel file relative to git root');
        Std.writeLine('  -g, --reaper-glob    Glob sub-pattern specifying where to search for barrel imports');
        Std.writeLine('');
        Std.writeLine('Optional arguments:');
        Std.writeLine('  -a, --barrel-alias   Import alias used to reference the barrel file in code');
        Std.writeLine('  -n, --no-format      Skip automatic Prettier code formatting');
        Std.writeLine('  -d, --dry-run        Preview changes without modifying files');
        Std.writeLine('');
        Std.writeLine('Examples:');
        Std.writeLine('  barrel-reaper --barrel-file src/barrel/index.ts --reaper-glob "src/**"');
        Std.writeLine('  barrel-reaper -b src/barrel/index.ts -a @barrel -g "src/**"');
        Std.writeLine('  barrel-reaper -b src/barrel/index.ts -g "src/**" -n -d');
        Std.writeLine('\x1b[0m');
        process.exit(1);
    }

    const reaper = new BarrelReaper({
        barrelAlias: args.barrelAlias,
        barrelFile: path.join(rootDir, args.barrelFile),
        dryRun: args.dryRun,
        noFormat: args.noFormat,
        reaperGlob: args.reaperGlob,
        rootDir,
    });

    await reaper.prepare();
    const confirm = await prompt('Scavenge barrel imports?');

    if (confirm) await reaper.reap();
    else process.exit(0);
};

main().catch((error) => {
    Std.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
