# barrel-reaper

Barrel files sunt diabolus. Amen.

Rewrites barrel imports as direct imports at the source. Respects
`tsconfig.json`, follows `.gitignore`, processes files in
parallel.

## Install

```sh
cargo install --path .
```

## Usage

```
Usage: barrel-reaper [OPTIONS] --barrel-file <PATH>

Options:
  -b, --barrel-file <PATH>    Path to the barrel file to reap
  -g, --search-glob <GLOB>    Glob scoping where consumers are searched (relative to --root-dir); omit to scan all
  -a, --barrel-alias <ALIAS>  Import alias the barrel is referenced by (e.g. "@lib"); omit for relative-only
      --root-dir <DIR>        Project root [default: .]
  -d, --dry-run               Compute rewrites without writing to disk
  -v, --verbose               Print each reaped file path
  -h, --help                  Print help
  -V, --version               Print version
```

## Examples

```sh
# dry run — show what would change
barrel-reaper -b src/lib/index.ts -a @lib -d

# rewrite in place, scoped to a subtree
barrel-reaper -b src/lib/index.ts -a @lib -g 'src/app/**'

# relative-imports-only project (no path alias)
barrel-reaper -b src/lib/index.ts
```

## Library

```rust
use barrel_reaper::{reap, Context};
use std::path::PathBuf;

let results = reap(&Context {
    barrel_file: PathBuf::from("src/lib/index.ts"),
    barrel_alias: Some("@lib".into()),
    search_glob: Some("src/**".into()),
    root_dir:    PathBuf::from("."),
    dry_run:     false,
});
```

## Development

```sh
cargo test                                                   # full suite
cargo test --release --test stress -- --ignored --nocapture  # benchmark
```

