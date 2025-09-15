import { BarrelReaper } from '@barrelreaper/src/reaper';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('BarrelReaper', () => {
    const rootDir = path.join(__dirname);

    test('should reap with alias', async () => {
        const reaper = new BarrelReaper({
            barrelFile: path.join(rootDir, 'fixtures/barrel/index.ts'),
            barrelAlias: '@barrelreaper/test/fixtures/barrel',
            reaperGlob: 'fixtures/mock',
            rootDir,
            dryRun: true,
            noFormat: true,
        });

        await reaper.prepare();
        const [result] = await reaper.reap();
        const expected = readFileSync(path.join(rootDir, 'fixtures/mock/index.expected'), { encoding: 'utf-8' });

        expect(result?.content).toEqual(expected);
    });

    test('should reap with relative paths only', async () => {
        const reaper = new BarrelReaper({
            barrelFile: path.join(rootDir, 'fixtures/barrel/index.ts'),
            reaperGlob: 'fixtures/relative-mock',
            rootDir,
            dryRun: true,
            noFormat: true,
        });

        await reaper.prepare();
        const [result] = await reaper.reap();
        const expected = readFileSync(path.join(rootDir, 'fixtures/relative-mock/index.expected'), { encoding: 'utf-8' });

        expect(result?.content).toEqual(expected);
    });
});
