use barrel_reaper::exports::{BarrelExport, collect_exports};
use barrel_reaper::imports::{BarrelImport, BarrelImportInfo, find_barrel_imports};
use barrel_reaper::resolver::ModuleResolver;
use barrel_reaper::{Context, SymbolKind, reap};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ---------- helpers ----------

fn ctx(barrel: &str, alias: Option<&str>, glob: &str) -> Context {
    Context {
        barrel_file: PathBuf::from(barrel),
        barrel_alias: alias.map(String::from),
        reaper_glob: glob.to_string(),
        root_dir: PathBuf::from("tests"),
        no_format: true,
        dry_run: true,
    }
}

fn assert_reap_matches(ctx: &Context, expected_path: &str) {
    let results = reap(ctx);
    assert_eq!(results.len(), 1, "expected exactly one rewritten file");
    let expected = fs::read_to_string(expected_path).unwrap();
    assert_eq!(results[0].content, expected);
}

fn all_specifiers(info: &BarrelImportInfo) -> Vec<&BarrelImport> {
    info.statements.iter().flat_map(|s| &s.imports).collect()
}

// ---------- fixture: full-suite (complex barrel exercised two ways) ----------

const FULL_BARREL: &str = "tests/fixtures/full-suite/barrel/index.ts";

fn full_suite_via_alias() -> Context {
    ctx(FULL_BARREL, Some("@barrel"), "full-suite/via-alias")
}

fn full_suite_via_relative() -> Context {
    ctx(FULL_BARREL, None, "full-suite/via-relative")
}

fn collected_exports() -> HashMap<String, BarrelExport> {
    let ctx = full_suite_via_alias();
    collect_exports(&ctx.barrel_file, &ctx, &ModuleResolver::new())
}

#[test]
fn collects_all_barrel_exports() {
    assert_eq!(collected_exports().len(), 18);
}

#[test]
fn direct_export_from_recursed_module_uses_aliased_path() {
    let exports = collected_exports();
    let a1 = exports.get("a1").expect("a1 missing");
    assert_eq!(a1.kind, SymbolKind::Named);
    assert_eq!(a1.source_path, "@barrel/module-a");
}

#[test]
fn renamed_default_reexport_keeps_default_kind() {
    let exports = collected_exports();
    let b = exports.get("B").expect("B missing");
    assert_eq!(b.kind, SymbolKind::Default);
    assert_eq!(b.source_path, "@barrel/module-b");
}

#[test]
fn barrel_default_export_is_recorded() {
    let exports = collected_exports();
    let default = exports.get("default").expect("default missing");
    assert_eq!(default.kind, SymbolKind::Default);
    assert_eq!(default.source_path, "@barrel/index");
}

#[test]
fn namespace_reexport_is_named() {
    let exports = collected_exports();
    let module_a = exports.get("ModuleA").expect("ModuleA missing");
    assert_eq!(module_a.kind, SymbolKind::Named);
    assert_eq!(module_a.source_path, "@barrel/module-a");
}

#[test]
fn renamed_named_reexport_keys_by_published_name() {
    let exports = collected_exports();
    assert!(exports.contains_key("b1Renamed"));
    assert!(exports.contains_key("b2Renamed"));
    assert_eq!(exports["b1Renamed"].kind, SymbolKind::Named);
}

#[test]
fn finds_imports_via_alias() {
    let ctx = full_suite_via_alias();
    let infos = find_barrel_imports(&ctx, &ModuleResolver::new());

    assert_eq!(infos.len(), 1);
    let info = &infos[0];
    assert!(info.file_path.ends_with("via-alias/consumer.ts"));
    assert_eq!(info.statements.len(), 3);
    let imports = all_specifiers(info);
    assert_eq!(imports.len(), 17);

    // `default as def` lives inside `{ ... }` so the AST classifies it as `Named`.
    // The export-side lookup decides default-vs-named output.
    let default_renamed = imports
        .iter()
        .find(|i| i.import_name == "default")
        .expect("default-as-def missing");
    assert_eq!(default_renamed.local_name.as_deref(), Some("def"));

    let typed = imports.iter().filter(|i| i.type_import).count();
    assert_eq!(typed, 4, "InterfaceA, InterfaceB, TypeA, TypeB");
}

#[test]
fn finds_imports_via_relative_paths() {
    let ctx = full_suite_via_relative();
    let infos = find_barrel_imports(&ctx, &ModuleResolver::new());

    assert_eq!(infos.len(), 1);
    let info = &infos[0];
    assert!(info.file_path.ends_with("via-relative/consumer.ts"));
    assert_eq!(info.statements.len(), 3);
    assert_eq!(all_specifiers(info).len(), 15);
}

#[test]
fn renamed_named_import_records_local_alias() {
    let ctx = full_suite_via_alias();
    let infos = find_barrel_imports(&ctx, &ModuleResolver::new());
    let imports = all_specifiers(&infos[0]);
    let renamed = imports
        .iter()
        .find(|i| i.import_name == "a1")
        .expect("a1 missing");
    assert_eq!(renamed.local_name.as_deref(), Some("a1LocalRenamed"));
    assert!(!renamed.type_import);
}

#[test]
fn unrenamed_named_import_has_no_local_alias() {
    let ctx = full_suite_via_alias();
    let infos = find_barrel_imports(&ctx, &ModuleResolver::new());
    let imports = all_specifiers(&infos[0]);
    let plain = imports
        .iter()
        .find(|i| i.import_name == "a2")
        .expect("a2 missing");
    assert_eq!(plain.local_name, None);
}

#[test]
fn reaps_full_suite_via_alias() {
    assert_reap_matches(
        &full_suite_via_alias(),
        "tests/fixtures/full-suite/via-alias/consumer.expected",
    );
}

#[test]
fn reaps_full_suite_via_relative_paths() {
    assert_reap_matches(
        &full_suite_via_relative(),
        "tests/fixtures/full-suite/via-relative/consumer.expected",
    );
}

// ---------- fixture: chained (A → B → C wildcard re-export chain) ----------

#[test]
fn reaps_through_chained_barrels() {
    assert_reap_matches(
        &ctx(
            "tests/fixtures/chained/barrel/index.ts",
            None,
            "chained/consumer",
        ),
        "tests/fixtures/chained/consumer/consumer.expected",
    );
}

// ---------- fixture: mixed (default + named + renamed + type) ----------

#[test]
fn reaps_mixed_default_named_renamed_type() {
    assert_reap_matches(
        &ctx(
            "tests/fixtures/mixed/barrel/index.ts",
            None,
            "mixed/consumer",
        ),
        "tests/fixtures/mixed/consumer/consumer.expected",
    );
}

// ---------- fixture: monorepo (per-package tsconfig discovery) ----------

/// `@core` is defined only in `packages/app/tsconfig.json` — *not* in
/// `packages/core/tsconfig.json`. Per-file tsconfig discovery is required.
#[test]
fn reaps_in_monorepo_with_per_package_tsconfig() {
    assert_reap_matches(
        &ctx(
            "tests/fixtures/monorepo/packages/core/src/index.ts",
            Some("@core"),
            "monorepo/packages/app",
        ),
        "tests/fixtures/monorepo/packages/app/src/consumer.expected",
    );
}

// ---------- resolver: relative resolution against full-suite/barrel ----------

fn full_barrel_dir() -> PathBuf {
    PathBuf::from("tests/fixtures/full-suite/barrel")
}

#[test]
fn resolver_resolves_relative_imports_within_barrel() {
    let resolved = ModuleResolver::new()
        .resolve("./module-a", &full_barrel_dir().join("index.ts"))
        .expect("resolution failed");
    assert_eq!(resolved, full_barrel_dir().join("module-a.ts"));
}

#[test]
fn resolver_resolves_cross_directory_imports() {
    let resolved = ModuleResolver::new()
        .resolve(
            "../barrel/module-b",
            &PathBuf::from("tests/fixtures/full-suite/via-relative/consumer.ts"),
        )
        .expect("resolution failed");
    assert_eq!(resolved, full_barrel_dir().join("module-b.ts"));
}

#[test]
fn resolver_resolves_sibling_modules() {
    let resolved = ModuleResolver::new()
        .resolve("./module-enum", &full_barrel_dir().join("module-a.ts"))
        .expect("resolution failed");
    assert_eq!(resolved, full_barrel_dir().join("module-enum.ts"));
}
