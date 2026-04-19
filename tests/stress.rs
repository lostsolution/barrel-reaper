// Run with:  cargo test --release --test stress -- --ignored --nocapture
//
// Generates a synthetic codebase (importers + noise files), then times `reap`
// over several runs. The `#[ignore]` keeps it out of the regular `cargo test`
// pass — it's a benchmark, not a correctness check.

use barrel_reaper::{Context, reap};
use std::fs;
use std::path::Path;
use std::time::Instant;

const N_IMPORTERS: usize = 2_000;
const N_NOISE: usize = 8_000;
const RUNS: usize = 5;

#[test]
#[ignore = "benchmark — opt-in via --ignored"]
fn stress_reap() {
    let tmp = std::env::temp_dir().join("barrel-reaper-bench");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).unwrap();

    println!(
        "Generating {N_IMPORTERS} importers + {N_NOISE} noise files in {}...",
        tmp.display()
    );
    let setup_start = Instant::now();
    generate(&tmp);
    println!("Setup: {:?}\n", setup_start.elapsed());

    let ctx = Context {
        barrel_file: tmp.join("barrel/index.ts"),
        barrel_alias: None,
        reaper_glob: "src".to_string(),
        root_dir: tmp.clone(),
        no_format: true,
        dry_run: true,
    };

    // Warm caches: parser code, allocators, etc.
    let _ = reap(&ctx);

    let mut times = Vec::with_capacity(RUNS);
    for i in 1..=RUNS {
        let start = Instant::now();
        let results = reap(&ctx);
        let elapsed = start.elapsed();
        times.push(elapsed);
        println!(
            "run {i}: reaped {} files in {:?} ({:.0} files/sec)",
            results.len(),
            elapsed,
            results.len() as f64 / elapsed.as_secs_f64()
        );
        assert_eq!(results.len(), N_IMPORTERS, "every importer should be rewritten");
    }

    let total: u128 = times.iter().map(|t| t.as_micros()).sum();
    let avg_us = total / RUNS as u128;
    println!("\nmean: {avg_us}µs over {RUNS} runs");

    let _ = fs::remove_dir_all(&tmp);
}

fn generate(root: &Path) {
    let barrel_dir = root.join("barrel");
    let src_dir = root.join("src");
    fs::create_dir_all(&barrel_dir).unwrap();
    fs::create_dir_all(&src_dir).unwrap();

    fs::write(
        barrel_dir.join("index.ts"),
        "export const foo = 1;\nexport const bar = 2;\nexport const baz = 3;\n",
    )
    .unwrap();

    for i in 0..N_IMPORTERS {
        let content = format!(
            "import {{ foo, bar, baz }} from '../barrel';\n\nexport const x{i} = foo + bar + baz;\n",
        );
        fs::write(src_dir.join(format!("importer_{i:05}.ts")), content).unwrap();
    }

    for i in 0..N_NOISE {
        let content = format!("export const noise{i} = {i};\n");
        fs::write(src_dir.join(format!("noise_{i:05}.ts")), content).unwrap();
    }
}
