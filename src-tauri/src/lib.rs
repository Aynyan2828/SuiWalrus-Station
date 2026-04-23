mod commands;

use commands::cli_runner;
use commands::settings;
use commands::fs_utils;
use commands::ai_proxy;
use commands::tradeport;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // .env ファイルを探索してロード（親ディレクトリも遡る）
    let mut current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    loop {
        let env_path = current_dir.join(".env");
        if env_path.exists() {
            // 手動でパースして強制的に set_var する (dotenvy::from_path は既存の変数を優先することがあるため)
            if let Ok(content) = std::fs::read_to_string(&env_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') { continue; }
                    if let Some((key, value)) = line.split_once('=') {
                        let key = key.trim();
                        let value = value.trim().replace('"', ""); // クォーテーション除去
                        std::env::set_var(key, value);
                    }
                }
            }
            println!("✅ .env manually loaded and forced from: {:?}", env_path);
            break;
        }
        if !current_dir.pop() {
            println!("💡 No .env file found in hierarchy.");
            break;
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            cli_runner::execute_command,
            cli_runner::check_cli_connection,
            settings::get_settings,
            settings::save_settings,
            settings::detect_config_paths,
            settings::load_command_history,
            settings::save_command_history,
            settings::load_wallet_metadata,
            settings::save_wallet_metadata,
            settings::load_portfolio_history,
            settings::save_portfolio_history,
            fs_utils::read_text_file,
            ai_proxy::call_ai_api,
            tradeport::call_tradeport_api,
        ])
        .run(tauri::generate_context!())
        .expect("SuiWalrus Station の起動に失敗しました");
}
