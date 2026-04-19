use std::io::IsTerminal;
use std::process::ExitCode;

use barrel_reaper::cli::{self, Args, Mode, decide_mode};
use clap::Parser;

fn main() -> ExitCode {
    let mut args = Args::parse();
    if !args.root_dir.is_absolute()
        && let Ok(abs) = std::fs::canonicalize(&args.root_dir)
    {
        args.root_dir = abs;
    }
    let stdin_tty = std::io::stdin().is_terminal();
    let stdout_tty = std::io::stdout().is_terminal();

    let mode = match decide_mode(&args, stdin_tty, stdout_tty) {
        Ok(mode) => mode,
        Err(msg) => {
            eprintln!("error: {msg}");
            return ExitCode::from(2);
        }
    };

    let result = match mode {
        Mode::Headless => cli::headless::run(&args),
        Mode::Tui => cli::tui::run(&args),
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("error: {err:#}");
            ExitCode::FAILURE
        }
    }
}
