import { SupportedToken } from '../../types/agent-types';

// ==========================================
// トークンレジストリ (ホワイトリスト)
// 本番環境ではJSON等の外部ファイルに外出しすることも想定
// ==========================================

export const SUPPORTED_TOKENS: SupportedToken[] = [
  {
    symbol: 'SUI',
    display_name: 'Sui',
    decimals: 9,
    coin_type: '0x2::sui::SUI',
    category: 'native',
    enabled: true,
    can_swap_source: true,
    can_swap_target: true,
  },
  {
    symbol: 'USDC',
    display_name: 'USDC',
    decimals: 6,
    coin_type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', // ネイティブ USDC
    category: 'stable',
    enabled: true,
    can_swap_source: true,
    can_swap_target: true,
  },
  {
    symbol: 'USDT',
    display_name: 'Tether USD',
    decimals: 6,
    coin_type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN', // Bridge USDT example
    category: 'stable',
    enabled: true,
    can_swap_source: true,
    can_swap_target: true,
  },
  {
    symbol: 'WAL',
    display_name: 'Walrus',
    decimals: 9, // Dummy
    coin_type: '0xwalrus_placeholder',
    category: 'utility',
    enabled: true,
    can_swap_source: false, // WALを売ることは当面制限
    can_swap_target: true,  // WALの積立は可能
  },
  {
    symbol: 'DEEP',
    display_name: 'DeepBook',
    decimals: 9, // Dummy
    coin_type: '0xdeep_placeholder',
    category: 'utility',
    enabled: true,
    can_swap_source: false,
    can_swap_target: true,
  },
  {
    symbol: 'IKA',
    display_name: 'IKA',
    decimals: 9, // Dummy
    coin_type: '0xika_placeholder',
    category: 'meme',
    enabled: true,
    can_swap_source: false,
    can_swap_target: true,
  }
];

/**
 * 渡された文字列から正規化したトークンシンボルを取得する
 * 例: "usdc", "UsdC" -> "USDC"
 */
export function normalizeTokenSymbol(input: string): string | null {
  const normalized = input.trim().toUpperCase();
  const token = SUPPORTED_TOKENS.find(t => t.symbol === normalized || t.display_name.toUpperCase() === normalized);
  return token && token.enabled ? token.symbol : null;
}

export function getTokenDetails(symbol: string): SupportedToken | null {
  return SUPPORTED_TOKENS.find(t => t.symbol === symbol) || null;
}
