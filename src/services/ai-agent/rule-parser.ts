import type { AppSettings } from '../../types';
import type { AgentRule } from '../../types/agent-types';
import { SUPPORTED_TOKENS } from './token-registry';
import { invoke } from '@tauri-apps/api/core';

/**
 * ユーザーの自然文入力から AgentRule または マーケット情報取得要求を生成する
 */
export async function parseIntentToRule(
  prompt: string,
  settings: AppSettings,
): Promise<any> {
  if (!settings.ai_api_key || settings.ai_api_key === 'sk-your-api-key-here') {
    throw new Error('AI APIキーが設定されていません。設定画面から設定してください。');
  }

  // ホワイトリストトークンの情報を文字列化
  const tokenListStr = SUPPORTED_TOKENS.filter(t => t.enabled)
    .map(t => `${t.symbol} (${t.category})`)
    .join(', ');

  const systemPrompt = `
あなたはSuiブロックチェーン専用の「SuiWalrusエージェント」のアシスタントです。
ユーザーからの自然文での依頼を受け取り、以下のいずれかのモードとして解釈し、JSONを出力してください。

### モード1: 自動積立て・条件実行 (Rule Generation)
積立てや価格アラート、即時実行の依頼。以下のJSONを出力してください。
{
  "type": "agent_rule",
  "strategy_type": "daily_dca_swap" | "weekly_dca_swap" | "condition_threshold" | "deposit_to_navi" | "buy_nft",
  "source_token": "USDC等",
  "target_token": "SUIやNAVI等",
  "amount": 数値,
  "nft_id": "NFT購入時のみ必要",
  "frequency": "daily" | "weekly" | "condition" | "once",
  "execution_time": "09:00",
  "condition_target": "SUI" (監視対象シンボル),
  "condition_operator": "<" | ">",
  "threshold_amount": 数値,
  "approval_mode": "manual_only" | "first_5_manual" | "auto"
}

### モード2: マーケット情報取得 (Market Intelligence)
NFT、価格、トレンド等の質問。以下のJSONを出力してください。
{
  "type": "market_query",
  "query_type": "collection_search" | "trending" | "floor_price" | "nft_detail",
  "search_term": "コレクション名",
  "nft_id": "NFTのID(特定の場合)",
  "explanation": "ユーザーへの一言回答（例: 'TradeportでSui8192の価格を調べてみるばい！'）"
}

## 許可されているトークン (ホワイトリスト)
${tokenListStr}

## 解釈ルール
- 「Naviに預けて」 → strategy_type: "deposit_to_navi"
- 「〇〇ドルになったら」 → strategy_type: "condition_threshold"
- 「このNFT買って」 → strategy_type: "buy_nft"
- 「NFTのトレンドは？」「Sui8192の価格は？」 → type: "market_query"

出力は必ず純粋なJSONオブジェクトのみを行ってください。
`;

  try {
    const data = await invoke<any>('call_ai_api', {
      baseUrl: settings.ai_base_url,
      apiKey: settings.ai_api_key,
      model: settings.ai_model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 500,
    });

    let content = data.choices?.[0]?.message?.content || '{}';

    // もしコードブロックが含まれていたら除去
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      content = match[0];
    }

    return JSON.parse(content);
  } catch (e) {
    throw new Error(`インテントの解析に失敗しました: ${e}`);
  }
}
