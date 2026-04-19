use std::fs;
use std::path::{Path, PathBuf};

use assert_cmd::Command;
use tempfile::TempDir;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn copy_dir(src: &Path, dst: &Path) {
    fs::create_dir_all(dst).unwrap();
    for entry in fs::read_dir(src).unwrap() {
        let entry = entry.unwrap();
        let ty = entry.file_type().unwrap();
        let target = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}

#[test]
fn dry_run_does_not_touch_files() {
    let tmp = TempDir::new().unwrap();
    copy_dir(
        &fixture_root().join("full-suite"),
        &tmp.path().join("full-suite"),
    );

    let consumer = tmp.path().join("full-suite/via-alias/consumer.ts");
    let before = fs::read_to_string(&consumer).unwrap();

    let output = Command::cargo_bin("barrel-reaper")
        .unwrap()
        .args([
            "-b",
            "full-suite/barrel/index.ts",
            "-g",
            "full-suite/via-alias/**",
            "-a",
            "@barrel",
            "-d",
            "--root-dir",
        ])
        .arg(tmp.path())
        .output()
        .unwrap();

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let after = fs::read_to_string(&consumer).unwrap();
    assert_eq!(before, after, "dry-run must not modify files");

    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stderr.contains("would reap"), "stderr was: {stderr}");
}

#[test]
fn write_mode_produces_expected_output() {
    let tmp = TempDir::new().unwrap();
    copy_dir(
        &fixture_root().join("full-suite"),
        &tmp.path().join("full-suite"),
    );

    let output = Command::cargo_bin("barrel-reaper")
        .unwrap()
        .args([
            "-b",
            "full-suite/barrel/index.ts",
            "-g",
            "full-suite/via-alias/**",
            "-a",
            "@barrel",
            "--root-dir",
        ])
        .arg(tmp.path())
        .output()
        .unwrap();

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let actual = fs::read_to_string(tmp.path().join("full-suite/via-alias/consumer.ts")).unwrap();
    let expected =
        fs::read_to_string(fixture_root().join("full-suite/via-alias/consumer.expected")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn missing_barrel_file_errors_clean() {
    let output = Command::cargo_bin("barrel-reaper")
        .unwrap()
        .args(["-b", "nonexistent.ts", "-g", "src/**"])
        .output()
        .unwrap();

    assert!(!output.status.success());
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stderr.contains("not found"), "stderr was: {stderr}");
}
