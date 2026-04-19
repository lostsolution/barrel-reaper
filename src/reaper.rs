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

    let new_imports: Vec<String> = info
        .statements
        .iter()
        .flat_map(|stmt| {
            stmt.imports
                .iter()
                .filter_map(|imp| Some(format_import(imp, exports.get(&imp.import_name)?, &info.file_path, ctx)))
        })
        .collect();

    let mut spans: Vec<Span> = info
        .statements
        .iter()
        .map(|s| expand_to_line_end(&source, s.span))
        .collect();
    spans.sort_by_key(|s| s.start);

    let body = remove_spans(&source, &spans);
    let content = format!("{}\n{body}", new_imports.join("\n"));

    Ok(ReapedFile {
        file_path: info.file_path.clone(),
        content,
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
                Some(local) => format!("{} as {local}", export.export_name),
                None => export.export_name.clone(),
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
