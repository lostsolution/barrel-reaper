use barrel_reaper::cli::Args;
use clap::Parser;

fn try_parse(argv: &[&str]) -> Result<Args, clap::Error> {
    let mut v = vec!["barrel-reaper"];
    v.extend_from_slice(argv);
    Args::try_parse_from(v)
}

#[test]
fn parses_short_flags() {
    let args = try_parse(&["-b", "barrel.ts", "-g", "src/**", "-a", "@lib", "-d", "-v"]).unwrap();
    assert_eq!(args.barrel_file.to_str(), Some("barrel.ts"));
    assert_eq!(args.search_glob.as_deref(), Some("src/**"));
    assert_eq!(args.barrel_alias.as_deref(), Some("@lib"));
    assert!(args.dry_run);
    assert!(args.verbose);
}

#[test]
fn parses_long_flags() {
    let args = try_parse(&[
        "--barrel-file",
        "barrel.ts",
        "--search-glob",
        "src/**",
        "--barrel-alias",
        "@lib",
        "--dry-run",
        "--verbose",
    ])
    .unwrap();
    assert_eq!(args.barrel_file.to_str(), Some("barrel.ts"));
    assert!(args.dry_run);
    assert!(args.verbose);
}

#[test]
fn barrel_file_is_required() {
    let err = try_parse(&[]).unwrap_err();
    assert!(err.to_string().to_lowercase().contains("barrel-file"));
}

#[test]
fn root_dir_defaults_to_current() {
    let args = try_parse(&["-b", "x.ts"]).unwrap();
    assert_eq!(args.root_dir.to_str(), Some("."));
}

#[test]
fn root_dir_accepts_override() {
    let args = try_parse(&["-b", "x.ts", "--root-dir", "/tmp/proj"]).unwrap();
    assert_eq!(args.root_dir.to_str(), Some("/tmp/proj"));
}
