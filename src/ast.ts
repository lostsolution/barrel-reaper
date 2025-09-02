import ts from 'typescript';

export const hasExportModifier = (node: ts.Node): boolean =>
    (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) ?? false;

export const hasDefaultModifier = (node: ts.Node): boolean =>
    (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) ?? false;

export const isValidReExport = (
    statement: ts.ExportDeclaration,
): statement is ts.ExportDeclaration & { moduleSpecifier: ts.StringLiteral } =>
    statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier);

export const hasNamedExports = (exportClause: ts.NamedExportBindings | undefined): exportClause is ts.NamedExports =>
    exportClause !== undefined && ts.isNamedExports(exportClause);

export const hasNamespacedExports = (
    exportClause: ts.NamedExportBindings | undefined,
): exportClause is ts.NamespaceExport => exportClause !== undefined && ts.isNamespaceExport(exportClause);

export const isNamedDeclaration = (
    statement: ts.Statement,
): statement is (ts.FunctionDeclaration | ts.ClassDeclaration) & { name: ts.Identifier } =>
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name !== undefined;

export const getLineRange = (statement: ts.Statement, sourceFile: ts.SourceFile): number[] => {
    const startLine = sourceFile.getLineAndCharacterOfPosition(statement.getStart()).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;
    return Array.from({ length: endLine - startLine + 1 }, (_, i) => startLine + i);
};

export const extractVariableNames = (statement: ts.VariableStatement): string[] =>
    statement.declarationList.declarations
        .map((decl) => (ts.isIdentifier(decl.name) ? decl.name.text : null))
        .filter((name): name is string => name !== null);

export const parseSourceFile = (filePath: string, content: string): ts.SourceFile =>
    ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
