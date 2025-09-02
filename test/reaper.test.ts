import { BarrelReaper } from '@barrelreaper/src/reaper';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('BarrelReaper', () => {
    const rootDir = path.join(__dirname);

    test('should reap', async () => {
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
});
