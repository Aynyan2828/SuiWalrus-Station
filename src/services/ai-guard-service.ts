// ==========================================
// AIガードサービス
// コマンド実行前の安全判定・説明・警告
// デフォルト: OpenAI API、将来: Ollama切替可能
// ==========================================
import type { AiGuardResult, AiMode, AppSettings } from '../types';
import { analyzeRiskLocally } from '../utils/risk-analyzer';

/**
 * AIガードでコマンドを分析する
 */
export async function analyzeCommand(
  command: string,
  cliType: 'sui' | 'walrus',
  network: string,
  walletAddress: string,
  settings: AppSettings,
): Promise<AiGuardResult> {
  // AIがオフの場合はローカル分析のみ
  if (settings.ai_mode === 'off') {
    return analyzeRiskLocally(command, cliType, network);
  }

  // API キーが未設定の場合もローカル分析
  if (!settings.ai_api_key || settings.ai_api_key === 'sk-your-api-key-here') {
    return analyzeRiskLocally(command, cliType, network);
  }

  try {
    const result = await callAiApi(command, cliType, network, walletAddress, settings);
    return result;
  } catch (error) {
    console.warn('AI API呼び出し失敗、ローカル分析に切替:', error);
    return analyzeRiskLocally(command, cliType, network);
  }
}

/**
 * AI API を呼び出す（OpenAI互換）
 */
async function callAiApi(
  command: string,
  cliType: 'sui' | 'walrus',
  network: string,
  walletAddress: string,
  settings: AppSettings,
): Promise<AiGuardResult> {
  const systemPrompt = `あなたはSui/Walrusブロックチェーンの安全ガードAIです。
ユーザーが実行しようとしているCLIコマンドを分析してください。

## 判定ルール
1. コマンドの意味を初心者にも分かるように簡潔に説明
2. 危険度を low / medium / high で判定
3. 実行すると何が起きるかを要約
4. 注意点や警告を列挙

## 特に注意すべきケース
- mainnet での操作 → 特に厳しく警告
- transfer / publish / upgrade → 取り消せない操作、送り先確認必須
- pay-all-sui → 残高ゼロになる可能性
- burn → データ消失の可能性
- 現在のネットワーク: ${network}
- 現在のウォレット: ${walletAddress}

## 出力フォーマット（JSON のみ）
{
  "risk_level": "low|medium|high",
  "summary": "このコマンドは○○を行います",
  "explanation": "詳細な説明...",
  "warnings": ["警告1", "警告2"],
  "recommendation": "実行しても安全です / 確認が必要です / 実行を推奨しません"
}`;

  const userPrompt = `CLIタイプ: ${cliType}
ネットワーク: ${network}
ウォレット: ${walletAddress}
コマンド: ${command}

このコマンドを分析してJSON形式で回答してください。`;

  const response = await fetch(`${settings.ai_base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.ai_api_key}`,
    },
    body: JSON.stringify({
      model: settings.ai_model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API エラー: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // JSONをパース
  try {
    // コードブロック内のJSONも対応
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AiGuardResult;
    }
  } catch {
    // パース失敗
  }

  // パースできない場合はデフォルト
  return {
    risk_level: 'medium',
    summary: content.slice(0, 200),
    explanation: content,
    warnings: ['AI応答のパースに失敗しました'],
    recommendation: '手動で確認してください',
  };
}

/**
 * AI接続テスト
 */
export async function testAiConnection(settings: AppSettings): Promise<{ success: boolean; message: string }> {
  if (!settings.ai_api_key) {
    return { success: false, message: 'APIキーが入力されていません' };
  }

  // タイムアウトを極めて長めに設定 (30分 = 1800秒)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800000);

  try {
    const response = await fetch(`${settings.ai_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.ai_api_key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.ai_model,
        messages: [{ role: 'user', content: 'Say "OK" if you can hear me.' }],
        max_tokens: 10,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, message: `エラー: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return { success: true, message: '接続成功！AIからの応答を確認しました。' };
    }

    return { success: false, message: '応答にデータが含まれていません' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, message: '接続タイムアウト（1800秒経過）。AIモデルのロードに非常に時間がかかっている可能性があります。' };
    }
    return { success: false, message: `通信エラー: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * AIモードの表示名を返す
 */
export function getAiModeLabel(mode: AiMode): string {
  switch (mode) {
    case 'guard': return '🛡️ ガードモード';
    case 'explain': return '📖 説明モード';
    case 'off': return '⚡ オフ';
  }
}
