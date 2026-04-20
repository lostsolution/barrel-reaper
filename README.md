<p align="center">
  <img src="logo.png" alt="barrel-reaper" width="220" />
</p>

<h2 align="center">barrel-reaper</h2>
<p align="center"><em>Barrel files sunt diabolus. Amen.</em><br>Rewrites barrel imports as direct imports at the source. </p>
<p align="center"><sub>Parses with <a href="https://oxc.rs">oxc</a>, walks files in parallel with <a href="https://github.com/rayon-rs/rayon">rayon</a>.</sub></p>


--- 

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
# dry run: show what would change
barrel-reaper -b src/lib/index.ts -a @lib -d

# rewrite in place, scoped to a subtree
barrel-reaper -b src/lib/index.ts -a @lib -g 'src/app/**'

# relative-imports-only project (no path alias)
barrel-reaper -b src/lib/index.ts
```

## Monorepos & path aliases

Resolution is delegated to the nearest `tsconfig.json` discovered per-file,
falling back to `node_modules` for bare specifiers outside of `paths`.
**Install your dependencies first** (`pnpm install`, `yarn`, etc.) so
workspace packages are symlinked under `node_modules`. Without this, bare
aliases like `@scope/pkg` can't be resolved and those imports are silently
treated as non-barrel.

If reaper finds fewer files than expected, run with `--debug`:

```sh
barrel-reaper -b packages/components/index.ts -g 'apps/account/**' \
  -a @scope/components -d --debug
```

For every file that *mentions* the barrel but whose imports didn't classify,
it prints each specifier's resolver outcome on stderr: enough to pinpoint
whether it's a missing `paths` entry, a sub-path import, or an uninstalled
workspace package.

## Library

```rust
use barrel_reaper::{reap, Context};
use std::path::PathBuf;

let results = reap(&Context {
    barrel_file:   PathBuf::from("src/lib/index.ts"),
    barrel_alias: Some("@lib".into()),
    search_glob:  Some("src/**".into()),
    root_dir:     PathBuf::from("."),
    dry_run:      false,
});
```

## Development

```sh
cargo test                                                   # full suite
cargo test --release --test stress -- --ignored --nocapture  # benchmark
```

