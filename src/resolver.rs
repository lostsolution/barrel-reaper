use std::path::{Path, PathBuf};

use oxc_resolver::{ResolveOptions, Resolver, TsconfigDiscovery};

pub struct ModuleResolver {
    inner: Resolver,
}

impl ModuleResolver {
    pub fn new() -> Self {
        let options = ResolveOptions {
            extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
                .map(String::from)
                .to_vec(),
            tsconfig: Some(TsconfigDiscovery::Auto),
            ..ResolveOptions::default()
        };
        Self {
            inner: Resolver::new(options),
        }
    }

    pub fn resolve(&self, specifier: &str, from_file: &Path) -> Option<PathBuf> {
        self.inner
            .resolve_file(from_file, specifier)
            .ok()
            .map(|res| res.full_path())
    }
}

impl Default for ModuleResolver {
    fn default() -> Self {
        Self::new()
    }
}
