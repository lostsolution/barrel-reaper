use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_parser::Parser;
use oxc_span::SourceType;

use crate::path::{barrel_export_path, resolve_export_path};
use crate::resolver::ModuleResolver;
use crate::{Context, SymbolKind};

#[derive(Debug, Clone)]
pub struct BarrelExport {
    pub source_path: String,
    pub kind: SymbolKind,
    pub source_file_path: Option<PathBuf>,
}

pub fn collect_exports(
    barrel_file: &Path,
    ctx: &Context,
    resolver: &ModuleResolver,
) -> HashMap<String, BarrelExport> {
    let Ok(barrel) = fs::canonicalize(barrel_file) else {
        return HashMap::new();
    };
    let mut exports = HashMap::new();
    let mut visited = HashSet::new();
    collect_into(
        &barrel,
        &barrel,
        ctx.barrel_alias.as_deref(),
        resolver,
        &mut exports,
        &mut visited,
    );
    exports
}

fn collect_into(
    file: &Path,
    barrel: &Path,
    alias: Option<&str>,
    resolver: &ModuleResolver,
    exports: &mut HashMap<String, BarrelExport>,
    visited: &mut HashSet<PathBuf>,
) {
    if !visited.insert(file.to_path_buf()) {
        return;
    }
    let Ok(source) = fs::read_to_string(file) else {
        return;
    };

    let barrel_dir = barrel.parent().unwrap_or(Path::new(""));
    let source_type = SourceType::from_path(file).unwrap_or_default();
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, &source, source_type).parse();

    for stmt in &parsed.program.body {
        match stmt {
            Statement::ExportAllDeclaration(decl) => {
                handle_export_all(decl, file, barrel, alias, resolver, exports, visited);
            }
            Statement::ExportNamedDeclaration(decl) => {
                handle_export_named(decl, file, barrel_dir, alias, resolver, exports);
            }
            // Only the barrel's own `export default` becomes the published
            // default. Defaults re-exported from deeper files arrive as
            // named specifiers and are handled by `handle_export_named`.
            Statement::ExportDefaultDeclaration(_) if file == barrel => {
                exports.insert(
                    "default".to_string(),
                    BarrelExport {
                        source_path: barrel_export_path(file, barrel_dir, alias),
                        kind: SymbolKind::Default,
                        source_file_path: Some(file.to_path_buf()),
                    },
                );
            }
            _ => {}
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_export_all(
    decl: &ExportAllDeclaration,
    file: &Path,
    barrel: &Path,
    alias: Option<&str>,
    resolver: &ModuleResolver,
    exports: &mut HashMap<String, BarrelExport>,
    visited: &mut HashSet<PathBuf>,
) {
    let from_module = decl.source.value.as_str();
    let resolved = resolver.resolve(from_module, file);

    match &decl.exported {
        // `export * as ns from './x'`: publishes `ns` as a single namespace.
        Some(name_node) => {
            exports.insert(
                name_node.name().to_string(),
                BarrelExport {
                    source_path: resolve_export_path(from_module, alias),
                    kind: SymbolKind::Named,
                    source_file_path: resolved,
                },
            );
        }
        // `export * from './x'`: recurse and hoist every named export.
        None => {
            if let Some(target) = resolved {
                collect_into(&target, barrel, alias, resolver, exports, visited);
            }
        }
    }
}

fn handle_export_named(
    decl: &ExportNamedDeclaration,
    file: &Path,
    barrel_dir: &Path,
    alias: Option<&str>,
    resolver: &ModuleResolver,
    exports: &mut HashMap<String, BarrelExport>,
) {
    if let Some(source) = &decl.source {
        let from_module = source.value.as_str();
        let resolved = resolver.resolve(from_module, file);
        let source_path = resolve_export_path(from_module, alias);

        for spec in &decl.specifiers {
            let kind = if spec.local.name() == "default" {
                SymbolKind::Default
            } else {
                SymbolKind::Named
            };
            exports.insert(
                spec.exported.name().to_string(),
                BarrelExport {
                    source_path: source_path.clone(),
                    kind,
                    source_file_path: resolved.clone(),
                },
            );
        }
    } else if let Some(declaration) = &decl.declaration {
        let source_path = barrel_export_path(file, barrel_dir, alias);
        for name in declaration_names(declaration) {
            exports.insert(
                name,
                BarrelExport {
                    source_path: source_path.clone(),
                    kind: SymbolKind::Named,
                    source_file_path: Some(file.to_path_buf()),
                },
            );
        }
    }
}

fn declaration_names(decl: &Declaration) -> Vec<String> {
    match decl {
        Declaration::VariableDeclaration(v) => v
            .declarations
            .iter()
            .filter_map(|d| d.id.get_identifier_name().map(|s| s.to_string()))
            .collect(),
        Declaration::FunctionDeclaration(f) => {
            f.id.as_ref()
                .map(|i| vec![i.name.to_string()])
                .unwrap_or_default()
        }
        Declaration::ClassDeclaration(c) => {
            c.id.as_ref()
                .map(|i| vec![i.name.to_string()])
                .unwrap_or_default()
        }
        Declaration::TSTypeAliasDeclaration(t) => vec![t.id.name.to_string()],
        Declaration::TSInterfaceDeclaration(i) => vec![i.id.name.to_string()],
        Declaration::TSEnumDeclaration(e) => vec![e.id.name.to_string()],
        _ => Vec::new(),
    }
}
