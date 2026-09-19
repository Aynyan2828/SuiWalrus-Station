//! OS ごとの CLI 既定パス解決
//!
//! Windows では従来の chocolatey / ProgramData 配下、
//! macOS / Linux では suiup (~/.local/bin) → Homebrew → cargo の順で探索する。
//! GUI アプリは Finder 起動時にシェルの PATH を継承せんけん、
//! 裸の "sui" ではなく絶対パスまで解決しておく。

use std::path::PathBuf;

/// CLI 名から既定の絶対パスを返す（見つからなければ裸の名前）
pub fn default_cli_path(name: &str) -> String {
    if cfg!(windows) {
        return match name {
            "sui" => r"C:\ProgramData\chocolatey\bin\sui".to_string(),
            "walrus" => r"C:\ProgramData\walrus\walrus".to_string(),
            "site-builder" => r"C:\ProgramData\walrus\site-builder.exe".to_string(),
            other => other.to_string(),
        };
    }

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let mut candidates: Vec<PathBuf> = vec![
        home.join(".local").join("bin").join(name),      // suiup
        PathBuf::from("/opt/homebrew/bin").join(name),   // Homebrew (Apple Silicon)
        PathBuf::from("/usr/local/bin").join(name),      // Homebrew (Intel) / 手動配置
        home.join(".cargo").join("bin").join(name),      // cargo install
    ];

    // シェルの PATH も一応なめる（ターミナル起動時に効く）
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            candidates.push(dir.join(name));
        }
    }

    candidates
        .into_iter()
        .find(|p| p.is_file())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string())
}

/// 空文字や未設定なら既定パスに差し替える
pub fn resolve_cli_path(configured: Option<String>, name: &str) -> String {
    match configured {
        Some(p) if !p.trim().is_empty() => p,
        _ => default_cli_path(name),
    }
}
