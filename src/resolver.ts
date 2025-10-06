import type { Maybe } from '@barrelreaper/src/types';
import path from 'node:path';
import ts from 'typescript';

/** TypeScript-powered module resolver that handles tsconfig path mapping,
 * baseUrl, module resolution strategies, and all the complexity that TS handles
 * instead of re-inventing the wheel for module resolution. */
export class ModuleResolver {
    private moduleCache: ts.ModuleResolutionCache;
    private compilerOptionsCache: Map<string, ts.CompilerOptions>;

    constructor() {
        const cwd = process.cwd();
        this.moduleCache = ts.createModuleResolutionCache(cwd, (fileName) => fileName);
        this.compilerOptionsCache = new Map();
    }

    public resolveModule(moduleSpecifier: string, containingFile: string): Maybe<string> {
        const options = this.getCompilerOptionsForFile(containingFile);
        const resolution = ts.resolveModuleName(moduleSpecifier, containingFile, options, ts.sys, this.moduleCache);
        return resolution.resolvedModule ? resolution.resolvedModule.resolvedFileName : undefined;
    }

    private getCompilerOptionsForFile(containingFile: string): ts.CompilerOptions {
        const dirName = path.dirname(containingFile);
        if (this.compilerOptionsCache.has(dirName)) return this.compilerOptionsCache.get(dirName)!;

        const configPath =
            ts.findConfigFile(containingFile, ts.sys.fileExists, 'tsconfig.json') ||
            ts.findConfigFile(containingFile, ts.sys.fileExists, 'jsconfig.json');

        const options = configPath
            ? (() => {
                  const { error, config } = ts.readConfigFile(configPath, ts.sys.readFile);
                  return error ? {} : ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath)).options;
              })()
            : {};

        this.compilerOptionsCache.set(dirName, options);
        return options;
    }
}

export const resolver = new ModuleResolver();
