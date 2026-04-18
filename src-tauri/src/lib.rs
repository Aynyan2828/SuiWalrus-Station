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
            match dotenvy::from_path(&env_path) {
                Ok(_) => println!("✅ .env loaded from: {:?}", env_path),
                Err(e) => eprintln!("⚠️ Failed to load .env from {:?}: {}", env_path, e),
            }
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
            fs_utils::read_text_file,
            ai_proxy::call_ai_api,
            tradeport::call_tradeport_api,
        ])
        .run(tauri::generate_context!())
        .expect("SuiWalrus Station の起動に失敗しました");
}
