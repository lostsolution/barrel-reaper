export type BarrelStatementType = 'default' | 'named';

export type BarrelReaperContext = {
    /** Barrel file path relative to the root of the git project */
    barrelFile: string;
    /** Alias to the barrel file */
    barrelAlias: string;
    /** Target files/directories  */
    reaperGlob: string;
    /** Absolute path to the git root director */
    rootDir: string;
    /** Formatting disabled */
    noFormat?: boolean;
    /** Return transformed content as string instead of writing to file */
    dryRun?: boolean;
};

export type BarrelReaperResult = {
    filePath: string;
    content: string;
};

export type BarrelExport = {
    exportName: string;
    sourcePath: string;
    exportType: BarrelStatementType;
};

export type BarrelExportMap = Record<string, BarrelExport>;

export type BarrelImportStatement = {
    /** The name as it appears in the barrel */
    importName: string;
    /** If the imported module was renamed */
    localName: string | undefined;
    /** Import statement type */
    importType: BarrelStatementType;
    /** Typed import */
    typeImport: boolean;
};

export type BarrelImportInfo = {
    filePath: string;
    imports: BarrelImportStatement[];
    lineNumbers: number[];
};
