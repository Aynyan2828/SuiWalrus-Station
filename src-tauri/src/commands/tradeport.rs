use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use super::settings::get_settings;

#[derive(Debug, Deserialize)]
pub struct TradeportRequest {
    pub query: String,
    pub variables: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeportResponse {
    pub data: Option<serde_json::Value>,
    pub errors: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn call_tradeport_api(
    request: TradeportRequest,
) -> Result<TradeportResponse, String> {
    // 1. 設定から API キーを取得
    let settings = get_settings().await?;
    
    if !settings.tradeport_enabled {
        return Err("Tradeport 連携が有効ではありません。設定画面から有効にしてください。".to_string());
    }

    if settings.tradeport_api_key.is_empty() || settings.tradeport_api_user.is_empty() {
        return Err("Tradeport API キーまたはユーザーIDが設定されていません。".to_string());
    }

    // 2. HTTP クライアントの準備
    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert("x-api-key", HeaderValue::from_str(&settings.tradeport_api_key)
        .map_err(|_| "無効な API キー形式です")?);
    headers.insert("x-api-user", HeaderValue::from_str(&settings.tradeport_api_user)
        .map_err(|_| "無効な ユーザーID 形式です")?);

    // 3. Tradeport へのリクエスト送信 (User provided endpoint: https://api.indexer.xyz/graphql)
    let endpoint = "https://api.indexer.xyz/graphql";
    
    let body = serde_json::json!({
        "query": request.query,
        "variables": request.variables.unwrap_or(serde_json::Value::Null),
    });

    println!("[Tradeport API] Sending Request to Indexer.xyz...");
    // println!("[Tradeport API] Body: {}", serde_json::to_string_pretty(&body).unwrap_or_default());

    let resp = client.post(endpoint)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Tradeport 通信エラー: {}", e))?;

    let status = resp.status();
    println!("[Tradeport API] Response Status: {}", status);

    if status == 401 || status == 403 {
        return Err("Tradeport API キーの認証に失敗しました。キーを確認してください。".to_string());
    } else if status == 429 {
        return Err("Tradeport API のレート制限に達しました。少し待って再試行してください。".to_string());
    } else if !status.is_success() {
        let err_body = resp.text().await.unwrap_or_default();
        eprintln!("[Tradeport API] Server Error Body: {}", err_body);
        return Err(format!("Tradeport API サーバーエラー ({}): 通信に失敗しました。", status));
    }

    let tradeport_resp: TradeportResponse = resp.json()
        .await
        .map_err(|e| format!("レスポンスのパースに失敗しました: {}", e))?;

    if let Some(ref data) = tradeport_resp.data {
        println!("[Tradeport API] Success. Data returned.");
    }
    if let Some(ref errors) = tradeport_resp.errors {
        eprintln!("[Tradeport API] GraphQL Errors: {}", serde_json::to_string_pretty(errors).unwrap_or_default());
    }

    Ok(tradeport_resp)
}
