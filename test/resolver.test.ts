import { ModuleResolver } from '@barrelreaper/src/resolver';
import { describe, expect, test } from 'bun:test';
import path from 'node:path';

describe('ModuleResolver', () => {
    const resolver = new ModuleResolver();
    const fixturesDir = path.join(__dirname, 'fixtures');

    test('should resolve relative imports within barrel fixtures', () => {
        const resolved = resolver.resolveModule('./module-a', path.join(fixturesDir, 'barrel/index.ts'));
        expect(resolved).toEqual(path.join(fixturesDir, 'barrel/module-a.ts'));
    });

    test('should resolve cross-directory imports in fixtures', () => {
        const resolved = resolver.resolveModule('../barrel/module-b', path.join(fixturesDir, 'mock/index.ts'));
        expect(resolved).toEqual(path.join(fixturesDir, 'barrel/module-b.ts'));
    });

    test('should resolve sibling modules in fixtures', () => {
        const resolved = resolver.resolveModule('./module-enum', path.join(fixturesDir, 'barrel/module-a.ts'));
        expect(resolved).toEqual(path.join(fixturesDir, 'barrel/module-enum.ts'));
    });
});
