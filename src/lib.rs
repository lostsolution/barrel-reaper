use std::fs;
use std::path::PathBuf;

#[cfg(feature = "cli")]
pub mod cli;
pub mod exports;
pub mod imports;
pub mod path;
pub mod reaper;
pub mod resolver;

use rayon::prelude::*;

use crate::exports::collect_exports;
use crate::imports::find_barrel_imports;
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
}

pub fn reap(ctx: &Context) -> Vec<ReapedFile> {
    let resolver = ModuleResolver::new();
    let exports = collect_exports(&ctx.barrel_file, ctx, &resolver);
    let imports = find_barrel_imports(ctx, &resolver);

    imports
        .par_iter()
        .filter_map(|info| {
            let result = reaper::rewrite_file(info, &exports, ctx).ok()?;
            if !ctx.dry_run {
                fs::write(&result.file_path, &result.content).ok()?;
            }
            Some(result)
        })
        .collect()
}
