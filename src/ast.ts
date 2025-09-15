import { Maybe } from '@barrelreaper/src/types';
import ts from 'typescript';

export const hasExportModifier = (node: ts.Node): boolean =>
    Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));

export const hasDefaultModifier = (node: ts.Node): boolean =>
    Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));

export const hasNamedExports = (clause: Maybe<ts.NamedExportBindings>): clause is ts.NamedExports =>
    Boolean(clause && ts.isNamedExports(clause));

export const hasNamespacedExports = (clause: Maybe<ts.NamedExportBindings>): clause is ts.NamespaceExport =>
    Boolean(clause && ts.isNamespaceExport(clause));

export const isValidReExport = (
    statement: ts.ExportDeclaration,
): statement is ts.ExportDeclaration & { moduleSpecifier: ts.StringLiteral } =>
    Boolean(statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier));

export const isNamedDeclaration = (
    statement: ts.Statement,
): statement is (ts.FunctionDeclaration | ts.ClassDeclaration) & { name: ts.Identifier } =>
    Boolean((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name);

export const extractVariableNames = ({ declarationList: { declarations } }: ts.VariableStatement): string[] =>
    declarations
        .map(({ name }) => (ts.isIdentifier(name) ? name.text : null))
        .filter((name): name is string => name !== null);

export const parseSourceFile = (filePath: string, content: string): ts.SourceFile =>
    ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

export const getLineRange = (statement: ts.Statement, source: ts.SourceFile): number[] => {
    const start = statement.getStart();
    const startLine = source.getLineAndCharacterOfPosition(start).line + 1;

    const end = statement.getEnd();
    const endLine = source.getLineAndCharacterOfPosition(end).line + 1;

    return Array.from({ length: endLine - startLine + 1 }, (_, i) => startLine + i);
};
