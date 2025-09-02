import * as stdModule from '@barrelreaper/src/std';
import { mock } from 'bun:test';

mock.module('prettier', () => ({
    format: mock((code) => code),
    resolveConfig: mock(() => Promise.resolve({})),
    default: {
        format: mock((code) => code),
        resolveConfig: mock(() => Promise.resolve({})),
    },
}));

mock.module('@barrelreaper/src/std', () => ({
    ...stdModule,
    Std: {
        write: mock(),
        writeLine: mock(),
        info: mock(),
        success: mock(),
        warning: mock(),
        error: mock(),
    },
}));
