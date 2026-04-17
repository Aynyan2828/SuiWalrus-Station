use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("ファイルが見つかりません: {}", path));
    }
    
    fs::read_to_string(p).map_err(|e| format!("ファイルの読み込みに失敗しました: {}", e))
}
