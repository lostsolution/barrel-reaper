export type Maybe<T> = T | undefined;
export type MaybeNull<T> = T | null;

export type BarrelStatementType = 'default' | 'named';

export type BarrelReaperArgs = {
    barrelFile?: string;
    barrelAlias?: string;
    reaperGlob?: string;
    noFormat: boolean;
    dryRun: boolean;
};

export type BarrelReaperContext = {
    /** Barrel file path relative to the root of the git project */
    barrelFile: string;
    /** Alias to the barrel file (optional - uses relative paths if not provided) */
    barrelAlias?: Maybe<string>;
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
    sourceFilePath?: string;
};

export type BarrelExportMap = Record<string, BarrelExport>;

export type BarrelImportStatement = {
    /** The name as it appears in the barrel */
    importName: string;
    /** If the imported module was renamed */
    localName: Maybe<string>;
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
