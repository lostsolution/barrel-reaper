import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { getLineRange, parseSourceFile } from './ast';
import { Std, ellipsePath } from './std';
import type { BarrelImportInfo, BarrelImportStatement, BarrelReaperContext } from './types';

export class BarrelImportReaper {
    private ctx: BarrelReaperContext;
    public imports: BarrelImportInfo[];

    constructor(ctx: BarrelReaperContext) {
        this.ctx = ctx;
        this.imports = [];
    }

    /** Reaps barrel imports from files matching the glob pattern.
     * Fast string check first, then AST parsing for confirmed matches */
    public async reap(): Promise<BarrelImportInfo[]> {
        const patterns = [`**/${this.ctx.reaperGlob}/**/*.{js,ts,tsx,jsx}`];

        const candidates = await glob(patterns, {
            cwd: this.ctx.rootDir,
            absolute: true,
            nodir: true,
            ignore: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/vendors/**',
                '**/vendor/**',
                '**/*.d.ts',
                '**/coverage/**',
                '**/.next/**',
                '**/out/**',
                '**/lib/**',
                '**/*.spec.{js,ts,tsx,jsx}',
                '**/*.test.{js,ts,tsx,jsx}',
                '**/mocks/**',
                '**/__mocks__/**',
            ],
        });

        for (const filePath of candidates) {
            const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
            if (content && this.hasBarrelImportString(filePath, content)) {
                const info = this.extractBarrelImports(filePath, content);
                this.imports.push(info);
            }
        }

        return this.imports;
    }

    /** Builds possible import paths for the barrel: relative paths and aliases.
     * Handles `/index` suffix that some IDEs auto-append */
    private getBarrelImportPatterns(filePath: string): string[] {
        const { barrelAlias, barrelFile } = this.ctx;
        const barrelDir = path.dirname(barrelFile);
        const relativeBarrelPath = path.relative(path.dirname(filePath), barrelDir);
        const normalizedRelativePath = relativeBarrelPath.replace(/\\/g, '/');

        return [normalizedRelativePath, `${normalizedRelativePath}/index`, barrelAlias, `${barrelAlias}/index`];
    }

    /** Tests if import path matches any barrel pattern */
    private isBarrelImport(moduleSpecifier: string, filePath: string): boolean {
        const patterns = this.getBarrelImportPatterns(filePath);
        return patterns.some((pattern) => moduleSpecifier === pattern);
    }

    /** Fast string search for barrel imports before expensive AST parsing.
     * Only supports single-quote imports */
    private hasBarrelImportString(filePath: string, content: string): boolean {
        const importPatterns = this.getBarrelImportPatterns(filePath).flatMap((pattern) => [
            `from '${pattern}'`,
            `from './${pattern}'`,
            `from '${pattern}/index'`,
        ]);

        return importPatterns.some((pattern) => content.includes(pattern));
    }

    /** Type guard for import declarations with string literal module specifier */
    private isStringImportDeclaration = (
        statement: ts.Statement,
    ): statement is ts.ImportDeclaration & { moduleSpecifier: ts.StringLiteral } =>
        ts.isImportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier);

    /** Reaps barrel import details via TypeScript AST parsing */
    private extractBarrelImports(filePath: string, content: string): BarrelImportInfo {
        const result: BarrelImportInfo = { filePath, imports: [], lineNumbers: [] };

        try {
            const sourceFile = parseSourceFile(filePath, content);

            sourceFile.statements.forEach((statement) => {
                if (this.isStringImportDeclaration(statement)) {
                    const moduleSpecifier = statement.moduleSpecifier.text; // Now type-safe!

                    if (this.isBarrelImport(moduleSpecifier, filePath)) {
                        const importedNames = this.extractImportStatements(statement);
                        const lineNumbers = getLineRange(statement, sourceFile);
                        result.imports.push(...importedNames);
                        result.lineNumbers.push(...lineNumbers);
                    }
                }
            });
        } catch (error) {
            const displayPath = ellipsePath(filePath, process.stdout.columns - 30);
            Std.warning(`Failed to parse ${displayPath}: ${error}`);
        }

        return result;
    }

    /** Reaps import names from confirmed barrel import declaration */
    private extractImportStatements(importDeclaration: ts.ImportDeclaration): BarrelImportStatement[] {
        const imports: BarrelImportStatement[] = [];
        const importClause = importDeclaration.importClause;

        if (!importClause) {
            return imports;
        }
        const typeImport = importClause.phaseModifier === ts.SyntaxKind.TypeKeyword;

        /** Default imports: `import Module from './barrel';` */
        if (importClause.name) {
            imports.push({
                importName: 'default',
                localName: importClause.name.text,
                importType: 'default',
                typeImport,
            });
        }

        /** Named imports: `import { a, b as c, d } from './barrel';` */
        if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            importClause.namedBindings.elements.forEach((element) => {
                const importName = element.propertyName?.text || element.name.text;
                const localName = element.name.text;

                imports.push({
                    importName,
                    localName: localName !== importName ? localName : undefined,
                    importType: 'named',
                    typeImport: element.isTypeOnly || typeImport,
                });
            });
        }

        /** Wildcard imports: `import * from './barrel';`
         * Noop in this case and warn. This is bad. */
        if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
            const fileName = ellipsePath(importDeclaration.getSourceFile().fileName, process.stdout.columns - 50);
            Std.warning(`Detected wildcard barrel re-export in ${fileName}`);
        }

        return imports;
    }

    public report() {
        const imports = this.imports.flatMap(({ imports }) => imports);
        const namedImports = imports.filter(({ importType, typeImport }) => !typeImport && importType === 'named');
        const defaultImports = imports.filter(({ importType, typeImport }) => !typeImport && importType === 'default');
        const typeImports = imports.filter(({ typeImport }) => typeImport);

        Std.success(`Detected ${imports.length} imports in ${this.imports.length} files:`);
        if (namedImports.length) Std.writeLine(`    - ${namedImports.length} named imports`);
        if (defaultImports.length) Std.writeLine(`    - ${defaultImports.length} default imports`);
        if (typeImports.length) Std.writeLine(`    - ${typeImports.length} type imports`);
        Std.writeLine('');
    }
}
