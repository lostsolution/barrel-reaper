use std::collections::HashMap;
use std::fs;
use std::path::Path;

use oxc_span::Span;

use crate::exports::BarrelExport;
use crate::imports::{BarrelImport, BarrelImportInfo};
use crate::path::get_import_path;
use crate::{Context, ReapedFile, SymbolKind};

pub fn rewrite_file(
    info: &BarrelImportInfo,
    exports: &HashMap<String, BarrelExport>,
    ctx: &Context,
) -> std::io::Result<ReapedFile> {
    let source = fs::read_to_string(&info.file_path)?;

    let mut spans: Vec<Span> = Vec::with_capacity(info.statements.len());
    let mut content = String::with_capacity(source.len());
    let mut imports_rewritten = 0;
    let mut unresolved: Vec<String> = Vec::new();

    for stmt in &info.statements {
        let any_resolvable = stmt
            .imports
            .iter()
            .any(|imp| exports.contains_key(&imp.import_name));

        // If no specifier in this statement resolves, leaving it intact
        // keeps the consumer compilable (it would fail the same way it did
        // before reaper ran) — dropping it gains nothing. Still flag each
        // name so the CLI can surface the mismatch.
        if !any_resolvable {
            unresolved.extend(stmt.imports.iter().map(|i| i.import_name.clone()));
            continue;
        }

        spans.push(expand_to_line_end(&source, stmt.span));
        for imp in &stmt.imports {
            match exports.get(&imp.import_name) {
                Some(export) => {
                    if imports_rewritten > 0 {
                        content.push('\n');
                    }
                    content.push_str(&format_import(imp, export, &info.file_path, ctx));
                    imports_rewritten += 1;
                }
                None => unresolved.push(imp.import_name.clone()),
            }
        }
    }
    spans.sort_by_key(|s| s.start);
    let body = remove_spans(&source, &spans);

    if imports_rewritten > 0 {
        content.push('\n');
    }
    content.push_str(&body);

    Ok(ReapedFile {
        file_path: info.file_path.clone(),
        content,
        imports_rewritten,
        unresolved,
    })
}

fn format_import(
    imp: &BarrelImport,
    export: &BarrelExport,
    from_file: &Path,
    ctx: &Context,
) -> String {
    let source_path = match (&ctx.barrel_alias, &export.source_file_path) {
        (None, Some(target)) => get_import_path(from_file, target),
        _ => export.source_path.clone(),
    };
    let type_prefix = if imp.type_import { "type " } else { "" };

    match export.kind {
        SymbolKind::Default => {
            let local = imp.local_name.as_deref().unwrap_or(&imp.import_name);
            format!("import {type_prefix}{local} from '{source_path}';")
        }
        SymbolKind::Named => {
            let binding = match &imp.local_name {
                Some(local) => format!("{} as {local}", imp.import_name),
                None => imp.import_name.clone(),
            };
            format!("import {type_prefix}{{ {binding} }} from '{source_path}';")
        }
    }
}

fn expand_to_line_end(source: &str, span: Span) -> Span {
    let end = span.end as usize;
    let new_end = source[end..]
        .find('\n')
        .map_or(source.len(), |i| end + i + 1);
    Span::new(span.start, new_end as u32)
}

fn remove_spans(source: &str, spans: &[Span]) -> String {
    let mut out = String::with_capacity(source.len());
    let mut cursor = 0;
    for span in spans {
        out.push_str(&source[cursor..span.start as usize]);
        cursor = span.end as usize;
    }
    out.push_str(&source[cursor..]);
    out
}
