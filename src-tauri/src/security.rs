use std::fs;
use std::path::{Component, Path};

pub const MAX_ZIP_ENTRIES: usize = 10_000;
pub const MAX_EXPANDED_BYTES: u64 = 512 * 1024 * 1024;

pub fn validate_epub_filename(path: &Path) -> Result<(), String> {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some(extension) if extension.eq_ignore_ascii_case("epub") => Ok(()),
        _ => Err("目前只支持 EPUB 文件".to_string()),
    }
}

pub fn validate_zip_member(name: &str) -> Result<(), String> {
    let path = Path::new(name);
    if path.is_absolute() || path.components().any(|component| matches!(component, Component::ParentDir)) {
        return Err("EPUB 包含不安全的路径".to_string());
    }
    Ok(())
}

pub fn ensure_regular_file(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("EPUB 路径不是普通文件".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn accepts_only_epub_extension() {
        assert!(validate_epub_filename(&PathBuf::from("book.EPUB")).is_ok());
        assert!(validate_epub_filename(&PathBuf::from("book.pdf")).is_err());
    }

    #[test]
    fn rejects_zip_traversal() {
        assert!(validate_zip_member("chapter.xhtml").is_ok());
        assert!(validate_zip_member("../outside").is_err());
        assert!(validate_zip_member("/outside").is_err());
    }
}
