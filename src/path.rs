use std::path::Path;

pub fn barrel_export_path(file: &Path, barrel_dir: &Path, alias: Option<&str>) -> String {
    let rel = file.strip_prefix(barrel_dir).unwrap_or(file);
    let without_ext = rel.with_extension("");
    let prefix = alias.unwrap_or(".");
    format!("{prefix}/{}", without_ext.display())
}

/// Picks the right `source_path` for a re-export. When the target resolves
/// inside `barrel_dir`, render it as a barrel-space path (alias or `./`);
/// otherwise fall back to aliasing the literal specifier — a later
/// consumer-relative rewrite in `reaper::format_import` will rescue
/// out-of-barrel cases when we have a resolved target.
pub fn resolved_export_path(
    resolved: Option<&Path>,
    literal: &str,
    barrel_dir: &Path,
    alias: Option<&str>,
) -> String {
    match resolved {
        Some(target) if target.starts_with(barrel_dir) => {
            barrel_export_path(target, barrel_dir, alias)
        }
        _ => aliased_literal(literal, alias),
    }
}

fn aliased_literal(from_module: &str, alias: Option<&str>) -> String {
    match (alias, from_module.strip_prefix("./")) {
        (Some(alias), Some(rest)) => format!("{alias}/{rest}"),
        _ => from_module.to_string(),
    }
}

pub fn is_relative_specifier(spec: &str) -> bool {
    spec.starts_with("./") || spec.starts_with("../")
}

/// Relative import string between two files. Always prefixed with `./` when
/// not climbing with `../`, since bare paths would parse as bare-package
/// specifiers.
pub fn get_import_path(from_file: &Path, to_file: &Path) -> String {
    let from_dir = from_file.parent().unwrap_or(Path::new(""));
    let rel = pathdiff::diff_paths(to_file, from_dir).unwrap_or_else(|| to_file.to_path_buf());
    let without_ext = rel.with_extension("");
    let normalized = without_ext.to_string_lossy().into_owned();
    if normalized.starts_with("../") {
        normalized
    } else {
        format!("./{normalized}")
    }
}
