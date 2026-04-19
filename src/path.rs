use std::path::Path;

pub fn barrel_export_path(file: &Path, barrel_dir: &Path, alias: Option<&str>) -> String {
    let rel = file.strip_prefix(barrel_dir).unwrap_or(file);
    let without_ext = rel.with_extension("");
    let prefix = alias.unwrap_or(".");
    format!("{prefix}/{}", without_ext.display())
}

pub fn resolve_export_path(from_module: &str, alias: Option<&str>) -> String {
    match (alias, from_module.strip_prefix("./")) {
        (Some(alias), Some(rest)) => format!("{alias}/{rest}"),
        _ => from_module.to_string(),
    }
}

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
