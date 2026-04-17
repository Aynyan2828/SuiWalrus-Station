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

import { invoke } from '@tauri-apps/api/core';

/**
 * AI API を呼び出す（Rustバックエンド経由）
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

  try {
    const data = await invoke<any>('call_ai_api', {
      baseUrl: settings.ai_base_url,
      apiKey: settings.ai_api_key,
      model: settings.ai_model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    const content = data.choices?.[0]?.message?.content || '';

    // JSONをパース
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as AiGuardResult;
      }
    } catch {
      // パース失敗時はフォールバック
    }

    return {
      risk_level: 'medium',
      summary: content.slice(0, 200),
      explanation: content,
      warnings: ['AI応答のパースに失敗しました'],
      recommendation: '手動で確認してください',
    };
  } catch (error) {
    throw new Error(`AI通信エラー: ${error}`);
  }
}

/**
 * AI接続テスト
 */
export async function testAiConnection(settings: AppSettings): Promise<{ success: boolean; message: string }> {
  if (!settings.ai_api_key) {
    return { success: false, message: 'APIキーが入力されていません' };
  }

  try {
    const data = await invoke<any>('call_ai_api', {
      baseUrl: settings.ai_base_url,
      apiKey: settings.ai_api_key,
      model: settings.ai_model,
      messages: [{ role: 'user', content: 'Say "OK" if you can hear me.' }],
      maxTokens: 10,
    });

    if (data.choices && data.choices.length > 0) {
      return { success: true, message: '接続成功！バックエンド経由でAIからの応答を確認したばい！' };
    }

    return { success: false, message: '応答にデータが含まれていません' };
  } catch (error) {
    return { success: false, message: `通信エラー（バックエンド経由）: ${error}` };
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
