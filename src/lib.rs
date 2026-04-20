use std::fs;
use std::path::PathBuf;

#[cfg(feature = "cli")]
pub mod cli;
pub mod exports;
pub mod imports;
pub mod path;
pub mod reaper;
pub mod resolver;

use crate::exports::collect_exports;
use crate::imports::walk_barrel_candidates;
use crate::resolver::ModuleResolver;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SymbolKind {
    Default,
    Named,
}

pub struct Context {
    pub barrel_file: PathBuf,
    pub barrel_alias: Option<String>,
    pub search_glob: Option<String>,
    pub root_dir: PathBuf,
    pub dry_run: bool,
}

pub struct ReapedFile {
    pub file_path: PathBuf,
    pub content: String,
    pub imports_rewritten: usize,
    /// Names imported from the barrel that weren't found in its exports.
    /// Callers (CLI, editor integrations) surface these as diagnostics.
    pub unresolved: Vec<String>,
}

pub fn reap(ctx: &Context) -> Vec<ReapedFile> {
    let resolver = ModuleResolver::new();
    let exports = collect_exports(&ctx.barrel_file, ctx, &resolver);

    walk_barrel_candidates(ctx, &resolver, |path, source, statements| {
        let result = reaper::rewrite(path.to_path_buf(), source, &statements, &exports, ctx);
        // Only write when something actually changed. Files with zero
        // rewrites are still returned (for their `unresolved` diagnostics).
        if !ctx.dry_run && result.imports_rewritten > 0 {
            fs::write(&result.file_path, &result.content).ok()?;
        }
        Some(result)
    })
}
