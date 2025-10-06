import fs from 'node:fs';
import path from 'node:path';

import { BarrelExportReaper } from './exports';
import { Formatter } from './formatter';
import { BarrelImportReaper } from './imports';
import { getImportPath } from './path';
import { ReaperSpinner } from './spinner';
import { Std, ellipsePath } from './std';
import type { BarrelImportInfo, BarrelImportStatement, BarrelReaperContext, BarrelReaperResult } from './types';

export class BarrelReaper {
    private ctx: BarrelReaperContext;
    private exportReaper: BarrelExportReaper;
    private importReaper: BarrelImportReaper;
    private spinner: ReaperSpinner;

    constructor(ctx: BarrelReaperContext) {
        this.ctx = ctx;
        this.exportReaper = new BarrelExportReaper(ctx);
        this.importReaper = new BarrelImportReaper(ctx);
        this.spinner = new ReaperSpinner();
        this.exportReaper.report();
    }

    /** First gathers all barrel export/imports from the codebase, then replaces them
     * with direct imports to their original sources using the export mapping. */
    public async prepare(): Promise<void> {
        this.spinner.start('Finding import files');
        await this.importReaper.reap();
        this.spinner.stop();

        this.importReaper.report();

        if (Object.keys(this.exportReaper.exports).length === 0) {
            throw new Error('No barrel exports found to reap.');
        }

        if (this.importReaper.imports.length === 0) {
            throw new Error('No barrel imports found to reap.');
        }
    }

    public async reap(): Promise<BarrelReaperResult[]> {
        const formatter = this.ctx.noFormat ? null : new Formatter();
        const results: BarrelReaperResult[] = [];

        for (const importInfo of this.importReaper.imports) {
            const filePath = path.relative(this.ctx.rootDir, importInfo.filePath);
            const displayPath = ellipsePath(filePath, process.stdout.columns - 50);

            this.spinner.start(`Reaping ${displayPath}`);
            const result = await this.transformFile(importInfo);

            if (this.ctx.dryRun) results.push(result);

            const formatted = await formatter?.formatFile(importInfo.filePath);
            let warning = this.ctx.dryRun ? ' \x1b[33m[dry-run]\x1b[0m' : '';
            warning += formatted === false ? ' \x1b[33m[⚠️ format error]\x1b[0m' : '';
            this.spinner.stop(`\x1b[33m→ Scavenged ${displayPath} [${importInfo.imports.length} imports]${warning}`);
        }

        return results;
    }

    /** Transforms a single file by replacing barrel imports with direct imports.
     * Removes original barrel import lines and injects new direct import statements
     * at the top of the file, then formats the result. */
    private async transformFile(importInfo: BarrelImportInfo): Promise<BarrelReaperResult> {
        try {
            const content = fs.readFileSync(importInfo.filePath, 'utf-8');
            const lines = content.split('\n');

            const newImports = await this.generateDirectImports(importInfo.imports, importInfo.filePath);
            const linesToRemove = new Set(importInfo.lineNumbers.map((n) => n - 1));
            const filteredLines = lines.filter((_, index) => !linesToRemove.has(index));
            const reaped = [...newImports, ...filteredLines].join('\n');

            if (!this.ctx.dryRun) await fs.promises.writeFile(importInfo.filePath, reaped);
            return { filePath: importInfo.filePath, content: reaped };
        } catch (err) {
            this.spinner.pause();
            const displayPath = ellipsePath(importInfo.filePath, process.stdout.columns - 30);
            Std.warning(`Failed transforming ${displayPath}, ${err}`);
            this.spinner.resume();

            return { filePath: importInfo.filePath, content: '' };
        }
    }

    /** Generates direct import statements by mapping each barrel import to its original
     * source using the export mapping. Preserves import types (default vs named) and
     * local aliases while resolving the correct source path */
    private async generateDirectImports(imports: BarrelImportStatement[], fromFile: string): Promise<string[]> {
        const importStatements: string[] = [];

        for (const { typeImport, importName, localName } of imports) {
            const barrelExport = this.exportReaper.exports[importName];

            if (!barrelExport) {
                this.spinner.pause();
                Std.warning(`Export ${importName} not found in barrel mapping`);
                this.spinner.resume();
                continue;
            }

            let sourcePath = barrelExport.sourcePath;
            if (!this.ctx.barrelAlias && barrelExport.sourceFilePath) {
                sourcePath = getImportPath(fromFile, barrelExport.sourceFilePath);
            }

            const typePrefix = typeImport ? 'type ' : '';
            const exportName = barrelExport.exportName;

            switch (barrelExport.exportType) {
                case 'default': {
                    /** Default import: `import Foo from './source'` or `import Foo as Baz from './source'` */
                    const module = localName ?? importName;
                    importStatements.push(`import ${typePrefix}${module} from '${sourcePath}';`);
                    break;
                }
                case 'named': {
                    /** Named import: `import { foo } from './source'` or `import { foo as bar } from './source'` */
                    const module = localName ? `${exportName} as ${localName}` : exportName;
                    importStatements.push(`import ${typePrefix}{ ${module} } from '${sourcePath}';`);
                    break;
                }
            }
        }

        return importStatements;
    }
}
