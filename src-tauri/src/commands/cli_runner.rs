use tauri::Emitter;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use regex::Regex;
use std::process::Stdio;

/// CLI実行結果の構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CliResult {
    pub stdout: String,
    pub stderr: String,
    pub raw_stdout: Option<String>,
    pub raw_stderr: Option<String>,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub cli_path: String,
    pub command: String,
    pub success: bool,
}

/// リアルタイムログ送信用のペイロード
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RealtimeLogPayload {
    pub message: String,
    pub level: String, // "stdout" | "stderr"
}

/// ANSIエスケープシーケンスを除去する
fn strip_ansi(text: &str) -> String {
    let re = Regex::new(r"[\u001b\u009b][\[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]").unwrap();
    re.replace_all(text, "").to_string()
}

/// 既存CLIを実行するコマンド (Tauri invoke用)
#[tauri::command]
pub async fn execute_command(
    window: tauri::Window,
    cli_type: String,
    args: Vec<String>,
    sui_cli_path: Option<String>,
    walrus_cli_path: Option<String>,
    site_builder_cli_path: Option<String>,
) -> Result<CliResult, String> {
    // CLIパスの決定
    let cli_path = match cli_type.as_str() {
        "sui" => sui_cli_path
            .unwrap_or_else(|| r"C:\ProgramData\chocolatey\bin\sui".to_string()),
        "walrus" => walrus_cli_path
            .unwrap_or_else(|| r"C:\ProgramData\walrus\walrus".to_string()),
        "site-builder" => site_builder_cli_path
            .unwrap_or_else(|| r"C:\ProgramData\walrus\site-builder.exe".to_string()),
        _ => return Err(format!("未対応のCLIタイプ: {}", cli_type)),
    };

    let quoted_args: Vec<String> = args.iter().map(|arg| {
        if arg.contains(' ') && !arg.starts_with('"') && !arg.ends_with('"') {
            format!("\"{}\"", arg)
        } else {
            arg.clone()
        }
    }).collect();

    let command_str = format!("{} {}", cli_path, quoted_args.join(" "));
    let start = Instant::now();

    // tokio::process::Command を使用して非同期実行
    let mut child = Command::new(&cli_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("CLI起動エラー: {} (パス: {})", e, cli_path))?;

    let stdout_handle = child.stdout.take().unwrap();
    let stderr_handle = child.stderr.take().unwrap();

    let window_clone = window.clone();
    let window_clone2 = window.clone();

    // タイムアウト付きで終了を待機 (デフォルト1800秒/30分)
    let execution = async move {
        use tokio::io::AsyncBufReadExt;
        
        let mut stdout_reader = tokio::io::BufReader::new(stdout_handle).lines();
        let mut stderr_reader = tokio::io::BufReader::new(stderr_handle).lines();

        let stdout_loop = async {
            let mut full_stdout = String::new();
            while let Ok(Some(line)) = stdout_reader.next_line().await {
                let clean_line = strip_ansi(&line);
                let _ = window_clone.emit("cli-realtime-log", RealtimeLogPayload {
                    message: clean_line,
                    level: "stdout".to_string(),
                });
                full_stdout.push_str(&line);
                full_stdout.push('\n');
            }
            full_stdout
        };

        let stderr_loop = async {
            let mut full_stderr = String::new();
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                let clean_line = strip_ansi(&line);
                let _ = window_clone2.emit("cli-realtime-log", RealtimeLogPayload {
                    message: clean_line,
                    level: "stderr".to_string(),
                });
                full_stderr.push_str(&line);
                full_stderr.push('\n');
            }
            full_stderr
        };

        let (res_wait, stdout_raw, stderr_raw) = tokio::join!(
            child.wait(),
            stdout_loop,
            stderr_loop
        );

        let status = res_wait.map_err(|e| e.to_string())?;
        
        Ok::<(std::process::ExitStatus, String, String), String>((status, stdout_raw, stderr_raw))
    };

    let (status, stdout_raw, stderr_raw) = match timeout(Duration::from_secs(1800), execution).await {
        Ok(res) => res?,
        Err(_) => {
            // タイムアウト時はプロセスを強制終了
            let _ = child.kill().await;
            return Err("実行タイムアウト (30分を超えました)".to_string());
        }
    };

    let duration = start.elapsed();
    let exit_code = status.code().unwrap_or(-1);
    
    // ANSI除去後のテキストを作成
    let stdout_clean = strip_ansi(&stdout_raw);
    let stderr_clean = strip_ansi(&stderr_raw);

    Ok(CliResult {
        stdout: stdout_clean,
        stderr: stderr_clean,
        raw_stdout: Some(stdout_raw),
        raw_stderr: Some(stderr_raw),
        exit_code,
        duration_ms: duration.as_millis() as u64,
        cli_path: cli_path.clone(),
        command: command_str,
        success: exit_code == 0,
    })
}

/// CLI接続確認の結果
#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub sui_available: bool,
    pub sui_version: String,
    pub sui_path: String,
    pub walrus_available: bool,
    pub walrus_version: String,
    pub walrus_path: String,
    pub site_builder_available: bool,
    pub site_builder_version: String,
    pub site_builder_path: String,
}

/// Sui/Walrus/SiteBuilder CLIの接続確認
#[tauri::command]
pub async fn check_cli_connection(
    sui_cli_path: Option<String>,
    walrus_cli_path: Option<String>,
    site_builder_cli_path: Option<String>,
) -> Result<ConnectionStatus, String> {
    let sui_path = sui_cli_path
        .unwrap_or_else(|| r"C:\ProgramData\chocolatey\bin\sui".to_string());
    let walrus_path = walrus_cli_path
        .unwrap_or_else(|| r"C:\ProgramData\walrus\walrus".to_string());
    let site_builder_path = site_builder_cli_path
        .unwrap_or_else(|| r"C:\ProgramData\walrus\site-builder.exe".to_string());

    // Sui CLI バージョン確認
    let (sui_available, sui_version) = match Command::new(&sui_path)
        .args(["--version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, version)
        }
        Ok(output) => {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            (false, format!("エラー: {}", err))
        }
        Err(e) => (false, format!("未検出: {}", e)),
    };

    // Walrus CLI バージョン確認
    let (walrus_available, walrus_version) = match Command::new(&walrus_path)
        .args(["--version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, version)
        }
        Ok(output) => {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            (false, format!("エラー: {}", err))
        }
        Err(e) => (false, format!("未検出: {}", e)),
    };

    // Walrus Site Builder CLI バージョン確認
    let (site_builder_available, site_builder_version) = match Command::new(&site_builder_path)
        .args(["--version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, version)
        }
        Ok(output) => {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            (false, format!("エラー: {}", err))
        }
        Err(e) => (false, format!("未検出: {}", e)),
    };

    Ok(ConnectionStatus {
        sui_available,
        sui_version,
        sui_path,
        walrus_available,
        walrus_version,
        walrus_path,
        site_builder_available,
        site_builder_version,
        site_builder_path,
    })
}
