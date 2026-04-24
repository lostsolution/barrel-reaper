use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_parser::Parser;
use oxc_span::SourceType;

use crate::path::{barrel_export_path, resolved_export_path};
use crate::resolver::ModuleResolver;
use crate::{Context, SymbolKind};

#[derive(Debug, Clone)]
pub struct BarrelExport {
    pub source_path: String,
    pub kind: SymbolKind,
    pub source_file_path: Option<PathBuf>,
}

struct ExportCollector<'a> {
    barrel: &'a Path,
    barrel_dir: &'a Path,
    alias: Option<&'a str>,
    resolver: &'a ModuleResolver,
    exports: HashMap<String, BarrelExport>,
    visited: HashSet<PathBuf>,
}

impl<'a> ExportCollector<'a> {
    fn handle_export_all(&mut self, decl: &ExportAllDeclaration, file: &Path) {
        let from_module = decl.source.value.as_str();
        let resolved = self.resolver.resolve(from_module, file);

        match &decl.exported {
            // `export * as ns from './x'`: publishes `ns` as a single namespace.
            Some(name_node) => {
                self.exports.insert(
                    name_node.name().to_string(),
                    BarrelExport {
                        source_path: resolved_export_path(
                            resolved.as_deref(),
                            from_module,
                            self.barrel_dir,
                            self.alias,
                        ),
                        kind: SymbolKind::Named,
                        source_file_path: resolved,
                    },
                );
            }
            // `export * from './x'`: recurse and hoist every named export.
            None => {
                if let Some(target) = resolved {
                    self.collect(&target);
                }
            }
        }
    }

    fn handle_export_named(&mut self, decl: &ExportNamedDeclaration, file: &Path) {
        if let Some(source) = &decl.source {
            let from_module = source.value.as_str();
            let resolved = self.resolver.resolve(from_module, file);
            let source_path = resolved_export_path(
                resolved.as_deref(),
                from_module,
                self.barrel_dir,
                self.alias,
            );
            self.insert_reexports(&decl.specifiers, &source_path, resolved.as_deref());
        } else if let Some(declaration) = &decl.declaration {
            let source_path = barrel_export_path(file, self.barrel_dir, self.alias);
            for name in declaration_names(declaration) {
                self.exports.insert(
                    name,
                    BarrelExport {
                        source_path: source_path.clone(),
                        kind: SymbolKind::Named,
                        source_file_path: Some(file.to_path_buf()),
                    },
                );
            }
        } else if !decl.specifiers.is_empty() {
            // `export { foo };` — republishing a local/imported binding. Point
            // at the current file and let TS follow any further re-export chain.
            let source_path = barrel_export_path(file, self.barrel_dir, self.alias);
            self.insert_reexports(&decl.specifiers, &source_path, Some(file));
        }
    }

    fn insert_reexports(
        &mut self,
        specifiers: &[ExportSpecifier<'_>],
        source_path: &str,
        source_file_path: Option<&Path>,
    ) {
        for spec in specifiers {
            let kind = if spec.local.name() == "default" {
                SymbolKind::Default
            } else {
                SymbolKind::Named
            };
            self.exports.insert(
                spec.exported.name().to_string(),
                BarrelExport {
                    source_path: source_path.to_string(),
                    kind,
                    source_file_path: source_file_path.map(Path::to_path_buf),
                },
            );
        }
    }

    fn collect(&mut self, file: &Path) {
        if !self.visited.insert(file.to_path_buf()) {
            return;
        }

        let Ok(source) = fs::read_to_string(file) else {
            return;
        };

        let source_type = SourceType::from_path(file).unwrap_or_default();
        let allocator = Allocator::default();
        let parsed = Parser::new(&allocator, &source, source_type).parse();

        for stmt in &parsed.program.body {
            match stmt {
                Statement::ExportAllDeclaration(decl) => {
                    self.handle_export_all(decl, file);
                }
                Statement::ExportNamedDeclaration(decl) => {
                    self.handle_export_named(decl, file);
                }
                // Only the barrel's own `export default` becomes the published
                // default. Defaults re-exported from deeper files arrive as
                // named specifiers and are handled by `handle_export_named`.
                Statement::ExportDefaultDeclaration(_) if file == self.barrel => {
                    self.exports.insert(
                        "default".to_string(),
                        BarrelExport {
                            source_path: barrel_export_path(file, self.barrel_dir, self.alias),
                            kind: SymbolKind::Default,
                            source_file_path: Some(file.to_path_buf()),
                        },
                    );
                }
                _ => {}
            }
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

pub fn collect_exports(
    barrel_file: &Path,
    ctx: &Context,
    resolver: &ModuleResolver,
) -> HashMap<String, BarrelExport> {
    let Ok(barrel) = fs::canonicalize(barrel_file) else {
        return HashMap::new();
    };

    let barrel_dir = barrel.parent().unwrap_or(Path::new("")).to_path_buf();

    let mut collector = ExportCollector {
        barrel: &barrel,
        barrel_dir: &barrel_dir,
        alias: ctx.barrel_alias.as_deref(),
        resolver,
        exports: HashMap::new(),
        visited: HashSet::new(),
    };

    collector.collect(&barrel);
    collector.exports
}
