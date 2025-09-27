import path from 'node:path';

import type { BarrelReaperContext } from './types';

export const pruneFileExtension = (filePath: string): string => filePath.replace(/\.(ts|tsx|js|jsx)$/, '');

/** Get export path for barrel file.  */
export const getBarrelExportPath = (filePath: string, ctx: BarrelReaperContext): string => {
    if (ctx.barrelAlias) {
        const relativePath = path.relative(path.dirname(ctx.barrelFile), filePath);
        const withoutExt = pruneFileExtension(relativePath);
        return `${ctx.barrelAlias}/${withoutExt}`.replace(/\\/g, '/');
    }

    const relativePath = path.relative(path.dirname(ctx.barrelFile), filePath);
    const withoutExt = pruneFileExtension(relativePath);
    return `./${withoutExt}`.replace(/\\/g, '/');
};

/** Get import path from one file to another */
export const getImportPath = (fromFile: string, toFile: string): string => {
    const relativePath = path.relative(path.dirname(fromFile), toFile);
    const withoutExt = pruneFileExtension(relativePath);
    const normalizedPath = withoutExt.replace(/\\/g, '/');
    return normalizedPath.startsWith('../') ? normalizedPath : `./${normalizedPath}`;
};

export const resolveExportPath = (exportFrom: string, ctx: BarrelReaperContext): string => {
    if (!exportFrom.startsWith('./')) return exportFrom;
    return ctx.barrelAlias ? `${ctx.barrelAlias}${exportFrom.slice(1)}` : exportFrom;
};
