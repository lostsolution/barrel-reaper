use std::process::ExitCode;

use barrel_reaper::cli::{self, Args};
use clap::Parser;

fn main() -> ExitCode {
    let mut args = Args::parse();
    if !args.root_dir.is_absolute()
        && let Ok(abs) = std::fs::canonicalize(&args.root_dir)
    {
        args.root_dir = abs;
    }

    match cli::headless::run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("error: {err:#}");
            ExitCode::FAILURE
        }
    }
}
