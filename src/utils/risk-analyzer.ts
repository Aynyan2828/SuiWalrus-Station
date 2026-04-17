// ==========================================
// ローカル危険度分析（AIなし版）
// APIキーがなくても動くルールベースの分析
// ==========================================
import type { AiGuardResult, RiskLevel } from '../types';

interface DangerousPattern {
  pattern: RegExp;
  risk: RiskLevel;
  description: string;
  warnings: string[];
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // High Risk
  {
    pattern: /\bpublish\b/i,
    risk: 'high',
    description: 'パッケージを公開します（元に戻せません）',
    warnings: ['この操作は元に戻せません', 'ネットワークを確認してください'],
  },
  {
    pattern: /\bupgrade\b/i,
    risk: 'high',
    description: 'パッケージをアップグレードします',
    warnings: ['既存のパッケージが変更されます', '互換性を確認してください'],
  },
  {
    pattern: /\btransfer\b/i,
    risk: 'high',
    description: 'オブジェクトまたはSUIを送信します',
    warnings: ['送り先アドレスを確認してください', '送信後は取り消せません'],
  },
  {
    pattern: /\btransfer-sui\b/i,
    risk: 'high',
    description: 'SUIを送金します',
    warnings: ['送金先と金額を再確認してください'],
  },
  {
    pattern: /\bpay-all-sui\b/i,
    risk: 'high',
    description: '全SUIを送金します（残高がゼロになる可能性）',
    warnings: ['⚠️ 残高がゼロになる可能性があります！', '送金先を必ず確認してください'],
  },
  {
    pattern: /\bpay-sui\b/i,
    risk: 'high',
    description: 'SUIを支払います',
    warnings: ['金額と送金先を確認してください'],
  },
  {
    pattern: /\bburn\b/i,
    risk: 'high',
    description: 'オブジェクトを焼却（削除）します',
    warnings: ['⚠️ この操作は元に戻せません', 'データが永久に失われます'],
  },
  {
    pattern: /\bdelete\b/i,
    risk: 'high',
    description: 'データを削除します',
    warnings: ['⚠️ 削除されたデータは復元できません'],
  },
  // Medium Risk
  {
    pattern: /\bcall\b/i,
    risk: 'medium',
    description: 'Move関数を呼び出します',
    warnings: ['呼び出し先のコントラクトを確認してください'],
  },
  {
    pattern: /\bsplit-coin\b/i,
    risk: 'medium',
    description: 'コインを分割します',
    warnings: ['ガス代が発生します'],
  },
  {
    pattern: /\bmerge-coin\b/i,
    risk: 'medium',
    description: 'コインを統合します',
    warnings: ['ガス代が発生します'],
  },
  {
    pattern: /\bstore\b/i,
    risk: 'medium',
    description: 'Walrusにデータを保存します',
    warnings: ['ストレージ料金が発生します'],
  },
  {
    pattern: /\bswitch\b/i,
    risk: 'medium',
    description: 'アクティブな設定を切り替えます',
    warnings: ['切替後のコマンドは新しい設定で実行されます'],
  },
  // Low Risk
  {
    pattern: /\bbalance\b/i,
    risk: 'low',
    description: '残高を確認します（読み取りのみ）',
    warnings: [],
  },
  {
    pattern: /\baddress/i,
    risk: 'low',
    description: 'アドレス情報を確認します（読み取りのみ）',
    warnings: [],
  },
  {
    pattern: /\bgas\b/i,
    risk: 'low',
    description: 'ガスコイン情報を確認します（読み取りのみ）',
    warnings: [],
  },
  {
    pattern: /\benvs?\b/i,
    risk: 'low',
    description: '環境設定を確認します（読み取りのみ）',
    warnings: [],
  },
  {
    pattern: /\bactive-/i,
    risk: 'low',
    description: '現在のアクティブ設定を確認します（読み取りのみ）',
    warnings: [],
  },
  {
    pattern: /\bfaucet\b/i,
    risk: 'low',
    description: 'テスト用SUIを取得します',
    warnings: ['テストネット専用です'],
  },
  {
    pattern: /\b(list-blobs|blob-status|info|health|blob-id)\b/i,
    risk: 'low',
    description: 'Walrus情報を確認します（読み取りのみ）',
    warnings: [],
  },
  {
    pattern: /\b--version\b/i,
    risk: 'low',
    description: 'バージョンを確認します',
    warnings: [],
  },
  {
    pattern: /\b--help\b/i,
    risk: 'low',
    description: 'ヘルプを表示します',
    warnings: [],
  },
];

/**
 * AIなしでローカルルールベースの危険度分析を行う
 */
export function analyzeRiskLocally(
  command: string,
  cliType: 'sui' | 'walrus',
  network: string,
): AiGuardResult {
  let matchedPattern: DangerousPattern | null = null;

  // パターンマッチ（最初にマッチしたものを使用）
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.pattern.test(command)) {
      matchedPattern = pattern;
      break;
    }
  }

  // マッチしなかった場合はmedium
  if (!matchedPattern) {
    matchedPattern = {
      pattern: /.*/,
      risk: 'medium',
      description: 'コマンドを実行します',
      warnings: ['未分類のコマンドです。内容を確認してください'],
    };
  }

  // mainnet の場合はリスクを上げる
  const warnings = [...matchedPattern.warnings];
  let risk = matchedPattern.risk;

  if (network.toLowerCase().includes('mainnet')) {
    if (risk !== 'low') {
      warnings.unshift('🔴 メインネットでの実行です！十分に注意してください');
    }
    if (risk === 'medium') {
      risk = 'high';
    }
  }

  const recommendation =
    risk === 'high'
      ? '⚠️ 高リスク操作です。実行前に内容を十分確認してください'
      : risk === 'medium'
        ? '確認してから実行することを推奨します'
        : '読み取り専用の安全な操作です';

  return {
    risk_level: risk,
    summary: `[${cliType.toUpperCase()}] ${matchedPattern.description}`,
    explanation: `コマンド: ${command}\n${matchedPattern.description}`,
    warnings,
    recommendation,
  };
}
