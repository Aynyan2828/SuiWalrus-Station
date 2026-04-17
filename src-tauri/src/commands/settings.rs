use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// アプリ設定
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub sui_cli_path: String,
    pub walrus_cli_path: String,
    pub site_builder_cli_path: String,
    pub site_builder_config_path: String,
    pub ai_provider: String,
    pub ai_api_key: String,
    pub ai_base_url: String,
    pub ai_model: String,
    pub ai_mode: String,
    pub log_level: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            sui_cli_path: r"C:\ProgramData\chocolatey\bin\sui".to_string(),
            walrus_cli_path: r"C:\ProgramData\walrus\walrus".to_string(),
            site_builder_cli_path: r"C:\ProgramData\walrus\site-builder.exe".to_string(),
            site_builder_config_path: String::new(),
            ai_provider: "openai".to_string(),
            ai_api_key: String::new(),
            ai_base_url: "https://api.openai.com/v1".to_string(),
            ai_model: "gpt-4o-mini".to_string(),
            ai_mode: "guard".to_string(),
            log_level: "info".to_string(),
        }
    }
}

/// コマンド実行履歴
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandHistoryEntry {
    pub id: String,
    pub command: String,
    pub cli_type: String,
    pub category: String,
    pub wallet_address: String,
    pub network: String,
    pub status: String,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub executed_at: String,
    pub ai_risk_level: Option<String>,
    pub ai_explanation: Option<String>,
}

/// ウォレットメタデータ（GUI側で管理するラベル等）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WalletMetadata {
    pub address: String,
    pub alias: String,
    pub label: String,
    pub tags: Vec<String>,
    pub is_favorite: bool,
}

/// 検出された設定パス
#[derive(Debug, Serialize, Deserialize)]
pub struct DetectedPaths {
    pub sui_config_dir: Option<String>,
    pub walrus_config_dir: Option<String>,
    pub sui_keystore: Option<String>,
    pub walrus_config_file: Option<String>,
}

/// 設定ファイルの保存パスを取得
fn get_settings_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("suiwalrus-station");
    fs::create_dir_all(&path).ok();
    path
}

fn get_settings_file() -> PathBuf {
    get_settings_path().join("settings.json")
}

fn get_history_file() -> PathBuf {
    get_settings_path().join("history.json")
}

fn get_wallet_metadata_file() -> PathBuf {
    get_settings_path().join("wallet_metadata.json")
}

/// 設定を読み込む
#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let path = get_settings_file();
    if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| format!("設定ファイル読み込みエラー: {}", e))?;
        let settings: AppSettings =
            serde_json::from_str(&data).unwrap_or_default();
        Ok(settings)
    } else {
        Ok(AppSettings::default())
    }
}

/// 設定を保存する
#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = get_settings_file();
    let data = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("設定シリアライズエラー: {}", e))?;
    fs::write(&path, data)
        .map_err(|e| format!("設定ファイル書き込みエラー: {}", e))?;
    Ok(())
}

/// Sui/Walrusの設定ディレクトリを自動検出する
/// 既存環境を壊さず、読み取り専用で探索する
#[tauri::command]
pub async fn detect_config_paths() -> Result<DetectedPaths, String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    // Sui設定ディレクトリの検出
    let sui_candidates = vec![
        home.join(".sui").join("sui_config"),
        home.join(".sui"),
    ];
    let sui_config_dir = sui_candidates.iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string());

    // Suiキーストアの検出
    let sui_keystore = sui_config_dir.as_ref().and_then(|dir| {
        let keystore_path = PathBuf::from(dir).join("sui.keystore");
        if keystore_path.exists() {
            Some(keystore_path.to_string_lossy().to_string())
        } else {
            None
        }
    });

    // Walrus設定ディレクトリの検出
    let walrus_candidates = vec![
        home.join(".walrus"),
        home.join(".config").join("walrus"),
    ];
    let walrus_config_dir = walrus_candidates.iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string());

    // Walrus設定ファイルの検出
    let walrus_config_candidates = vec![
        home.join(".walrus").join("client_config.yaml"),
        home.join(".walrus").join("client_config.yml"),
        home.join(".config").join("walrus").join("client_config.yaml"),
        home.join(".config").join("walrus").join("client_config.yml"),
    ];
    let walrus_config_file = walrus_config_candidates.iter()
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string());

    Ok(DetectedPaths {
        sui_config_dir,
        walrus_config_dir,
        sui_keystore,
        walrus_config_file,
    })
}

/// コマンド履歴を読み込む
#[tauri::command]
pub async fn load_command_history() -> Result<Vec<CommandHistoryEntry>, String> {
    let path = get_history_file();
    if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| format!("履歴ファイル読み込みエラー: {}", e))?;
        let history: Vec<CommandHistoryEntry> =
            serde_json::from_str(&data).unwrap_or_default();
        Ok(history)
    } else {
        Ok(Vec::new())
    }
}

/// コマンド履歴を保存する
#[tauri::command]
pub async fn save_command_history(history: Vec<CommandHistoryEntry>) -> Result<(), String> {
    let path = get_history_file();
    let data = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("履歴シリアライズエラー: {}", e))?;
    fs::write(&path, data)
        .map_err(|e| format!("履歴ファイル書き込みエラー: {}", e))?;
    Ok(())
}

/// ウォレットメタデータを読み込む
#[tauri::command]
pub async fn load_wallet_metadata() -> Result<Vec<WalletMetadata>, String> {
    let path = get_wallet_metadata_file();
    if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| format!("メタデータ読み込みエラー: {}", e))?;
        let metadata: Vec<WalletMetadata> =
            serde_json::from_str(&data).unwrap_or_default();
        Ok(metadata)
    } else {
        Ok(Vec::new())
    }
}

/// ウォレットメタデータを保存する
#[tauri::command]
pub async fn save_wallet_metadata(metadata: Vec<WalletMetadata>) -> Result<(), String> {
    let path = get_wallet_metadata_file();
    let data = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("メタデータシリアライズエラー: {}", e))?;
    fs::write(&path, data)
        .map_err(|e| format!("メタデータ書き込みエラー: {}", e))?;
    Ok(())
}
