use std::io::{IsTerminal, Write};
use std::time::Instant;

use anyhow::{Result, bail};

use crate::{Context, reap};

use super::Args;

pub fn run(args: &Args) -> Result<()> {
    let barrel_file = if args.barrel_file.is_absolute() {
        args.barrel_file.clone()
    } else {
        args.root_dir.join(&args.barrel_file)
    };

    if !barrel_file.exists() {
        bail!("barrel file not found: {}", barrel_file.display());
    }

    let ctx = Context {
        barrel_file,
        barrel_alias: args.barrel_alias.clone(),
        search_glob: args.search_glob.clone(),
        root_dir: args.root_dir.clone(),
        dry_run: args.dry_run,
    };

    let started = Instant::now();
    let results = reap(&ctx);
    let elapsed = started.elapsed();

    let stderr_tty = std::io::stderr().is_terminal();
    let mut stderr = std::io::stderr().lock();

    if args.verbose {
        for r in &results {
            let display = r
                .file_path
                .strip_prefix(&ctx.root_dir)
                .unwrap_or(&r.file_path);
            writeln!(stderr, "reaped: {}", display.display())?;
        }
    }

    let total_imports: usize = results.iter().map(|r| r.imports_rewritten).sum();
    let verb = if ctx.dry_run { "would reap" } else { "reaped" };
    let summary = format!(
        "{verb} {} file{} · {} import{} rewritten · {:.2?}",
        results.len(),
        if results.len() == 1 { "" } else { "s" },
        total_imports,
        if total_imports == 1 { "" } else { "s" },
        elapsed,
    );

    if stderr_tty {
        writeln!(stderr, "\x1b[1m{summary}\x1b[0m")?;
    } else {
        writeln!(stderr, "{summary}")?;
    }

    Ok(())
}
