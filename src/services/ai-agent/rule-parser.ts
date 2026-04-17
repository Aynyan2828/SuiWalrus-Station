// ==========================================
// AI Agent - 自然文からルールへのパーサー
// ==========================================
import type { AppSettings } from '../../types';
import type { AgentRule } from '../../types/agent-types';
import { SUPPORTED_TOKENS } from './token-registry';

/**
 * ユーザーの自然文入力から AgentRule の構造化データを生成する
 */
export async function parseIntentToRule(
  prompt: string,
  settings: AppSettings,
): Promise<Partial<AgentRule>> {
  if (!settings.ai_api_key || settings.ai_api_key === 'sk-your-api-key-here') {
    throw new Error('AI APIキーが設定されていません。設定画面から設定してください。');
  }

  // ホワイトリストトークンの情報を文字列化
  const tokenListStr = SUPPORTED_TOKENS.filter(t => t.enabled)
    .map(t => `${t.symbol} (${t.category})`)
    .join(', ');

const systemPrompt = `
あなたはSuiブロックチェーン専用の自動積立てエージェントのアシスタントです。
ユーザーからの自然文での依頼を受け取り、以下のJSONスキーマに沿ったルール案を出力してください。

## 許可されているトークン (ホワイトリスト)
${tokenListStr}
※これ以外のトークンが指定された場合は、適宜近いものに正規化するか、エラーを返すような内容にしてください。

## 期待するJSON構造
{
  "strategy_type": "daily_dca_swap" | "weekly_dca_swap" | "condition_threshold" | "deposit_to_navi",
  "source_token": "USDC等",
  "target_token": "SUIやNAVI等 (預け入れの場合はsource_tokenと同じにする)",
  "amount": 数値 (例: 2),
  "frequency": "daily" | "weekly" | "condition",
  "execution_time": "09:00" (日次の場合),
  "condition_target": "SUI" (価格条件の監視対象のトークンシンボル、条件型のみ),
  "condition_operator": "<" または ">" (指定価格以下なら '<'、指定価格以上なら '>'),
  "threshold_amount": 2 (監視価格の数値、例えば2ドルなら2),
  "approval_mode": "manual_only" | "first_5_manual" | "auto" (ユーザー指示がなければ first_5_manual をデフォルト)
}

## 特殊解釈ルール
- 「Naviに預けて」「Lend」「Deposit」「Supply」と言われた場合は \`strategy_type: "deposit_to_navi"\` とし、target_token は source_token と同じ値（例: 元手がSUIならSUI）にしてください。
- 「〇〇ドルになったら」「〇〇ドル以下で」等、価格をトリガーにする場合は \`strategy_type: "condition_threshold"\` および \`frequency: "condition"\` とし、condition_target(対象通貨), condition_operator(未満なら <), threshold_amount(価格数値) を必ず設定してください。

出力は必ず純粋なJSONオブジェクトのみを行ってください。Markdownのブロック（\`\`\`json 等）は含めないでください。
`;

  try {
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
          { role: 'user', content: prompt },
        ],
        temperature: 0.2, // 決定論的に
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API エラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';

    // もしコードブロックが含まれていたら除去
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      content = match[0];
    }

    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    throw new Error(`ルールの解析に失敗しました: ${e}`);
  }
}
