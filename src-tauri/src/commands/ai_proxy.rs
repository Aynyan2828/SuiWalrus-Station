use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct AiProxyRequest {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub messages: Vec<AiMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiProxyResponse {
    pub success: bool,
    pub content: String,
    pub error: Option<String>,
}

/// AI APIを呼び出すバックエンドコマンド
#[tauri::command]
pub async fn call_ai_api(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<AiMessage>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<serde_json::Value, String> {
    // URLの正規化
    let mut url = base_url.trim_end_matches('/').to_string();
    if !url.ends_with("/chat/completions") {
        url.push_str("/chat/completions");
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(60)) // 接続テスト用よりは短め、通常の推論用
        .build()
        .map_err(|e| format!("Client生成エラー: {}", e))?;

    let payload = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.3),
        "max_tokens": max_tokens.unwrap_or(500),
    });

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("通信エラー: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("レスポンス読み取りエラー: {}", e))?;

    if !status.is_success() {
        return Err(format!("AI API エラー ({}): {}", status, text));
    }

    let json_res: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("JSONパースエラー: {}", e))?;

    Ok(json_res)
}
