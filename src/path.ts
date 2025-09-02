import fs from 'node:fs';
import path from 'node:path';

import type { BarrelReaperContext } from './types';

export const getRelativeSourcePath = (filePath: string, ctx: BarrelReaperContext): string => {
    const relativePath = path.relative(path.dirname(ctx.barrelFile), filePath);
    const withoutExt = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');
    return `${ctx.barrelAlias}/${withoutExt}`.replace(/\\/g, '/');
};

export const resolveSourcePath = (exportFrom: string, ctx: BarrelReaperContext): string =>
    exportFrom.startsWith('./') ? `${ctx.barrelAlias}${exportFrom.slice(1)}` : exportFrom;

export const resolveRelativeModulePath = (relativeModulePath: string, currentFile: string): string | null => {
    if (!relativeModulePath.startsWith('.')) return null;

    const currentDir = path.dirname(currentFile);
    const resolved = path.resolve(currentDir, relativeModulePath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    for (const ext of extensions) {
        const candidate = resolved + ext;
        if (fs.existsSync(candidate)) return candidate;
    }

    return null;
};
