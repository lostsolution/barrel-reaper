use std::fs;
use std::path::{Path, PathBuf};

use globset::{Glob, GlobMatcher};
use ignore::{DirEntry, WalkBuilder};
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};
use rayon::prelude::*;

use crate::resolver::ModuleResolver;
use crate::{Context, SymbolKind};

const DEFAULT_IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    ".cache",
    ".next",
    ".turbo",
    ".svelte-kit",
    "coverage",
    "out",
];

#[derive(Debug, Clone)]
pub struct BarrelImport {
    pub import_name: String,
    pub local_name: Option<String>,
    pub kind: SymbolKind,
    pub type_import: bool,
}

#[derive(Debug, Clone)]
pub struct BarrelImportStatement {
    pub span: Span,
    pub imports: Vec<BarrelImport>,
}

#[derive(Debug, Clone)]
pub struct BarrelImportInfo {
    pub file_path: PathBuf,
    pub statements: Vec<BarrelImportStatement>,
}

pub fn find_barrel_imports(ctx: &Context, resolver: &ModuleResolver) -> Vec<BarrelImportInfo> {
    let Ok(barrel_path) = fs::canonicalize(&ctx.barrel_file) else {
        return Vec::new();
    };
    let needles = build_needles(ctx);
    let matcher: Option<GlobMatcher> = ctx
        .search_glob
        .as_deref()
        .and_then(|g| Glob::new(g).ok().map(|g| g.compile_matcher()));

    let candidates: Vec<DirEntry> = WalkBuilder::new(&ctx.root_dir)
        .standard_filters(true)
        .filter_entry(|entry| {
            entry
                .file_name()
                .to_str()
                .is_none_or(|name| !DEFAULT_IGNORED_DIRS.contains(&name))
        })
        .build()
        .filter_map(Result::ok)
        .filter(|entry| is_candidate_file(entry, &ctx.root_dir, matcher.as_ref()))
        .collect();

    candidates
        .par_iter()
        .filter_map(|entry| {
            let path = fs::canonicalize(entry.path()).ok()?;
            let source = fs::read_to_string(&path).ok()?;
            if !could_have_barrel_import(&source, &needles) {
                return None;
            }
            let statements = extract_barrel_statements(&path, &source, &barrel_path, resolver);
            (!statements.is_empty()).then_some(BarrelImportInfo {
                file_path: path,
                statements,
            })
        })
        .collect()
}

fn build_needles(ctx: &Context) -> Vec<String> {
    let mut needles = Vec::with_capacity(2);
    if let Some(alias) = &ctx.barrel_alias {
        needles.push(alias.clone());
    }
    if let Some(name) = ctx
        .barrel_file
        .parent()
        .and_then(Path::file_name)
        .and_then(|n| n.to_str())
    {
        needles.push(name.to_string());
    }
    needles
}

fn could_have_barrel_import(source: &str, needles: &[String]) -> bool {
    needles.is_empty() || needles.iter().any(|n| source.contains(n.as_str()))
}

fn is_candidate_file(entry: &DirEntry, root_dir: &Path, matcher: Option<&GlobMatcher>) -> bool {
    if !entry.file_type().is_some_and(|ft| ft.is_file()) {
        return false;
    }
    let path = entry.path();
    let ext = path.extension().and_then(|e| e.to_str());
    if !matches!(ext, Some("ts" | "tsx" | "js" | "jsx")) {
        return false;
    }
    if path
        .file_stem()
        .and_then(|s| s.to_str())
        .is_some_and(|s| s.ends_with(".d"))
    {
        return false;
    }
    let Some(matcher) = matcher else {
        return true;
    };
    let rel = path.strip_prefix(root_dir).unwrap_or(path);
    matcher.is_match(rel)
}

fn extract_barrel_statements(
    file: &Path,
    source: &str,
    barrel_path: &Path,
    resolver: &ModuleResolver,
) -> Vec<BarrelImportStatement> {
    let source_type = SourceType::from_path(file).unwrap_or_default();
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, source_type).parse();

    parsed
        .program
        .body
        .iter()
        .filter_map(|stmt| {
            let Statement::ImportDeclaration(decl) = stmt else {
                return None;
            };
            if !is_barrel_import(decl.source.value.as_str(), file, resolver, barrel_path) {
                return None;
            }
            Some(BarrelImportStatement {
                span: stmt.span(),
                imports: extract_specifiers(decl),
            })
        })
        .collect()
}

fn is_barrel_import(
    spec: &str,
    from_file: &Path,
    resolver: &ModuleResolver,
    barrel_path: &Path,
) -> bool {
    // oxc_resolver may return absolute (no tsconfig) or relative-to-tsconfig
    // form (with path mappings). Component-wise suffix match handles both.
    resolver
        .resolve(spec, from_file)
        .is_some_and(|p| barrel_path.ends_with(&p))
}

fn extract_specifiers(decl: &ImportDeclaration) -> Vec<BarrelImport> {
    let stmt_type_only = decl.import_kind.is_type();
    let Some(specifiers) = &decl.specifiers else {
        return Vec::new();
    };

    specifiers
        .iter()
        .filter_map(|spec| match spec {
            ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => Some(BarrelImport {
                import_name: "default".to_string(),
                local_name: Some(s.local.name.to_string()),
                kind: SymbolKind::Default,
                type_import: stmt_type_only,
            }),
            ImportDeclarationSpecifier::ImportSpecifier(s) => {
                let imported = s.imported.name();
                let local = s.local.name.as_str();
                Some(BarrelImport {
                    import_name: imported.to_string(),
                    local_name: (local != imported).then(|| local.to_string()),
                    kind: SymbolKind::Named,
                    type_import: stmt_type_only || s.import_kind.is_type(),
                })
            }
            ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => None,
        })
        .collect()
}
