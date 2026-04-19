use std::path::PathBuf;

use clap::Parser;

pub mod headless;

#[derive(Parser, Debug, Clone)]
#[command(
    name = "barrel-reaper",
    about = "Barrel files sunt diabolus. Amen.",
    version
)]
pub struct Args {
    /// Path to the barrel file to reap (relative to --root-dir unless absolute)
    #[arg(short = 'b', long, value_name = "PATH")]
    pub barrel_file: PathBuf,

    /// Glob pattern (relative to --root-dir) scoping where consumers are searched; omit to scan all
    #[arg(short = 'g', long, value_name = "GLOB")]
    pub search_glob: Option<String>,

    /// Import alias the barrel is referenced by (e.g. "@lib"); omit for relative-only mode
    #[arg(short = 'a', long, value_name = "ALIAS")]
    pub barrel_alias: Option<String>,

    /// Project root used for module resolution and as the base for relative paths
    #[arg(long, value_name = "DIR", default_value = ".")]
    pub root_dir: PathBuf,

    /// Compute rewrites without writing to disk
    #[arg(short = 'd', long)]
    pub dry_run: bool,

    /// Print each reaped file path
    #[arg(short = 'v', long)]
    pub verbose: bool,
}
