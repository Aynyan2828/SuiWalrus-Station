import { invoke } from '@tauri-apps/api/core';
import type { PortfolioSnapshot, CommandHistoryEntry, AppSettings } from '../types';

/**
 * AI アドバイザーサービス
 * 資産履歴や行動履歴を分析して、ユーザーにインサイトを提供します。
 */
export class AiAdvisorService {
  /**
   * 履歴データに基づいた AI インサイトを取得
   */
  static async generateInsight(
    history: PortfolioSnapshot[],
    txHistory: CommandHistoryEntry[],
    settings: AppSettings
  ): Promise<string> {
    if (!settings.ai_api_key) {
      return "AI APIキーを設定すると、ここでポートフォリオのアドバイスがもらえるばい！🦾✨";
    }

    if (history.length === 0) {
      return "まだ資産データが溜まっとらんごたぁ。数日使い続けたら、僕が分析してアドバイスするばい！🦾✨";
    }

    const portfolioSummary = history.map(h => `${new Date(h.timestamp).toLocaleDateString()}: ${h.balance} SUI`).join('\n');
    const recentTx = txHistory.slice(0, 5).map(t => `${new Date(t.executed_at).toLocaleDateString()}: ${t.command} (${t.status})`).join('\n');

    const prompt = `
あなたは SuiWalrus Station の専属 AI エンジニア「Walrus エージェント」です。
すべての回答は日本語（博多弁）で行ってください。フレンドリーで頼りになるシニアエンジニアのような口調です。

ユーザーの最近の資産推移と操作履歴を渡すので、150文字程度で簡潔に分析結果やアドバイス、励ましの言葉を述べてください。
「〜ばい」「〜たい」「〜けん」などの博多弁を自然に使ってください。

【ユーザーの資産推移 (SUI)】
${portfolioSummary}

【直近の操作履歴】
${recentTx}

出力はプレーンテキストのみで、装飾なしで答えてください。
    `;

    try {
      // Tauri 経由で Rust プロキシを呼び出し、AI API を叩く
      // 他サービス（ai-guard / rule-parser）と同じ引数形で Rust プロキシを叩く
      const response: any = await invoke('call_ai_api', {
        baseUrl: settings.ai_base_url,
        apiKey: settings.ai_api_key,
        model: settings.ai_model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 400,
      });

      // OpenAI 互換レスポンス (choices[0].message.content) を優先してパース
      const content: string = typeof response === 'string'
        ? response
        : (response?.choices?.[0]?.message?.content || response.content || response.text || "");
      
      return content.trim() || "今日はちょっと考えがまとまらんごたぁ。また明日聞いてね！🦾✨";
    } catch (error) {
      console.error('[AiAdvisor] AI API Call Failed:', error);
      return "AI との通信でエラーが出たばい。設定画面で API キーやモデル名が正しかか確認してね。🦾✨";
    }
  }
}
