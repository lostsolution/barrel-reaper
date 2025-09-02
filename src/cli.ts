#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import path from 'node:path';

import { logo } from './logo';
import { BarrelReaper } from './reaper';
import { Std } from './std';

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
    const args = process.argv.slice(2);

    const flagIndex = args.findIndex((arg) => arg.startsWith('--'));
    const flags = flagIndex !== -1 ? args.slice(flagIndex) : [];
    const positionalArgs = flagIndex !== -1 ? args.slice(0, flagIndex) : args;
    const noFormat = flags.includes('--no-format');
    const dryRun = flags.includes('--dry-run');

    const barrelFile = positionalArgs[0];
    const barrelAlias = positionalArgs[1];
    const reaperGlob = positionalArgs[2];

    if (!(barrelFile && barrelAlias && reaperGlob)) {
        Std.writeLine('\x1b[37m');
        Std.writeLine('Usage: barrel-reaper <barrel-file> <barrel-alias> <reaper-glob> [--no-format] [--dry-run]');
        Std.writeLine('');
        Std.writeLine('Arguments:');
        Std.writeLine('  barrel-file   : Path to the barrel file relative to git root');
        Std.writeLine('  barrel-alias  : Import alias used to reference the barrel file in code');
        Std.writeLine('  reaper-glob   : Glob sub-pattern specifying where to search for barrel imports');
        Std.writeLine('');
        Std.writeLine('Options:');
        Std.writeLine('  --no-format   : Skip automatic Prettier code formatting');
        Std.writeLine('  --dry-run     : Preview changes without modifying files');
        Std.writeLine('');
        Std.writeLine('Examples:');
        Std.writeLine('  barrel-reaper src/barrel/index.ts @barrel');
        Std.writeLine('  barrel-reaper src/barrel/index.ts @barrel "{applications,packages}"');
        Std.writeLine('  barrel-reaper src/barrel/index.ts @barrel --dry-run');
        Std.writeLine('\x1b[0m');
        process.exit(1);
    }
    try {
        const reaper = new BarrelReaper({
            barrelFile: path.join(rootDir, barrelFile),
            barrelAlias,
            rootDir,
            reaperGlob,
            noFormat,
            dryRun,
        });

        await reaper.prepare();
        const confirm = await prompt('Scavenge barrel imports?');
        if (confirm) await reaper.reap();
        else process.exit(0);
    } catch (error) {
        Std.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    }
};

void main();
