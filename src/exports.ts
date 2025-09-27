import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
    extractVariableNames,
    hasDefaultModifier,
    hasExportModifier,
    hasNamedExports,
    hasNamespacedExports,
    isNamedDeclaration,
    isValidReExport,
    parseSourceFile,
} from './ast';
import { getBarrelExportPath, resolveExportPath } from './path';
import { resolver } from './resolver';
import { Std, ellipsePath } from './std';
import type { BarrelExportMap, BarrelReaperContext } from './types';

export class BarrelExportReaper {
    private ctx: BarrelReaperContext;
    private visited: Set<string>;
    public exports: BarrelExportMap;

    constructor(ctx: BarrelReaperContext) {
        this.ctx = ctx;
        this.visited = new Set();
        this.exports = {};

        this.collectExports(ctx.barrelFile);
    }

    /** Extracts re-exports from barrel files. For named exports, maps each export
     * to its source. For wildcard exports, recursively processes the target file to
     * gather all its exports into the current mapping. Handles both direct named
     * re-exports and wildcard flattening of entire modules */
    private processReexports(statement: ts.ExportDeclaration, filePath: string): BarrelExportMap {
        if (!isValidReExport(statement)) return {};

        const exports: BarrelExportMap = {};
        const fromModule = statement.moduleSpecifier.text;
        const sourceFilePath = resolver.resolveModule(fromModule, filePath);
        const sourcePath = resolveExportPath(fromModule, this.ctx);

        if (!sourceFilePath) return exports;

        if (hasNamedExports(statement.exportClause)) {
            /** Named re-export: `export { a, b as c } from './file'` */
            statement.exportClause.elements.forEach((element) => {
                const exportName = element.name.text;
                const originalName = element.propertyName?.text ?? exportName;

                exports[exportName] = {
                    exportName,
                    exportType: originalName === 'default' ? 'default' : 'named',
                    sourcePath,
                    sourceFilePath,
                };
            });
        } else if (hasNamespacedExports(statement.exportClause)) {
            /** Namespace export: `export * as ModuleName from './file'` */
            const exportName = statement.exportClause.name.text;
            exports[exportName] = {
                exportName,
                exportType: 'named',
                sourcePath,
                sourceFilePath,
            };
        } else {
            /** Wildcard re-exporting: `export * from './file'` - recursively collect all exports */
            const targetPath = resolver.resolveModule(fromModule, filePath);
            if (targetPath) {
                const targetExports = this.collectExports(targetPath);
                Object.assign(exports, targetExports);
            }
        }

        return exports;
    }

    /** Processes direct exports from source files and maps each exported
     * identifier to its source location and export type. Handles variables,
     * functions, classes, and default exports with proper type classification */
    private processDirectExports(statement: ts.Statement, sourceFilePath: string): BarrelExportMap {
        const sourcePath = getBarrelExportPath(sourceFilePath, this.ctx);
        const exports: BarrelExportMap = {};

        /** Direct export assignment (CommonJS): `export = something` */
        if (ts.isExportAssignment(statement)) {
            exports.default = {
                exportName: 'default',
                exportType: 'default',
                sourcePath,
                sourceFilePath,
            };
            return exports;
        }

        if (!hasExportModifier(statement)) return exports;

        if (ts.isVariableStatement(statement)) {
            /** Variable exports: `export const a = 1, b = 2` */
            extractVariableNames(statement).forEach((exportName) => {
                exports[exportName] = {
                    exportName,
                    exportType: 'named',
                    sourcePath,
                    sourceFilePath,
                };
            });
        } else if (isNamedDeclaration(statement)) {
            /** Function/class exports: `export function foo()` or `export default Bar` */
            const isDefault = hasDefaultModifier(statement);
            const name = statement.name.text;
            const exportName = isDefault ? 'default' : name;
            const exportType = isDefault ? 'default' : 'named';

            /** Default exports in re-exported files should not be reflected to avoid conflicts */
            if (isDefault && sourceFilePath !== this.ctx.barrelFile) {
                const displayPath = ellipsePath(sourceFilePath, process.stdout.columns - 40);
                Std.warning(`Default export found in re-exported file: ${displayPath}`);
                return exports;
            }

            exports[exportName] = {
                exportName,
                exportType,
                sourcePath,
                sourceFilePath,
            };
        } else if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement)) {
            /** Type alias exports: `export type MyType = string` */
            const exportName = statement.name.text;
            exports[exportName] = {
                exportName,
                exportType: 'named',
                sourcePath,
                sourceFilePath,
            };
        } else if (ts.isInterfaceDeclaration(statement) && hasExportModifier(statement)) {
            /** Interface exports: `export interface MyInterface { ... }` */
            const exportName = statement.name.text;
            exports[exportName] = {
                exportName,
                exportType: 'named',
                sourcePath,
                sourceFilePath,
            };
        } else if (ts.isEnumDeclaration(statement) && hasExportModifier(statement)) {
            /** Enum exports: `export enum MyEnum { ... }` */
            const exportName = statement.name.text;
            exports[exportName] = {
                exportName,
                exportType: 'named',
                sourcePath,
                sourceFilePath,
            };
        }

        return exports;
    }

    /** Recursively collects all export statements from barrel file and its dependencies.
     * Uses visited tracking to prevent infinite loops in circular barrel chains */
    collectExports(filePath: string): BarrelExportMap {
        const normalizedPath = path.resolve(filePath);

        /** Skip visited/missing files. This avoids circular dependencies
         * potentially causing infinite loops during recursive collection */
        if (this.visited.has(normalizedPath) || !fs.existsSync(normalizedPath)) return {};
        this.visited.add(normalizedPath);

        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = parseSourceFile(filePath, content);

        sourceFile.statements.forEach((statement) => {
            /** Export declarations are re-export statements with moduleSpecifiers,
             * while direct exports are bound to local declarations (vars, funcs, classes) */
            const exports = ts.isExportDeclaration(statement)
                ? this.processReexports(statement, filePath)
                : this.processDirectExports(statement, filePath);

            Object.assign(this.exports, exports);
        });

        return this.exports;
    }

    public report() {
        const reexports = Object.values(this.exports);
        const namedExports = reexports.filter(({ exportType }) => exportType === 'named');
        const defaultExports = reexports.filter(({ exportType }) => exportType === 'default');

        Std.success(`Collected ${reexports.length} exports:`);
        Std.writeLine(`    - ${namedExports.length} named`);
        Std.writeLine(`    - ${defaultExports.length} default`);
        Std.writeLine('');
    }
}
