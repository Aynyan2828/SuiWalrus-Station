// ==========================================
// AI Agent - 実行ドライバー (Execution Driver)
// ==========================================
import type { AgentTask, AgentRule, AgentHistory } from '../../types/agent-types';
import type { AppSettings } from '../../types';
import * as sdkService from '../sui-sdk/sui-sdk-service';
import { SUPPORTED_TOKENS } from './token-registry';
import { shouldApplyFee, calculateFeeBreakdown, DEFAULT_FEE_CONFIG, toRawAmount } from './fee-engine';

export interface ExecutionResult {
  status: 'success' | 'failed';
  digest?: string;
  errorMessage?: string;
  spentAmount: number; // 元本
  feeAmount: number;   // 実際に徴収した手数料
  netAmount: number;   // 手数料控除後の実行額
}

/**
 * 承認されたタスクを元にトランザクションを作成し、Suiネットワークに送信する
 */
export async function executeAgentTask(
  task: AgentTask,
  rule: AgentRule,
  settings: AppSettings,
  activeAddress: string,
  activeEnv: 'mainnet' | 'testnet' | 'devnet' | 'localnet'
): Promise<ExecutionResult> {
  try {
    if (!activeAddress) {
      throw new Error('アクティブなウォレットアドレスが選択されていません。');
    }

    // ネットワーク固定機能（ルールで mainnet が指定されているなら一致チェック）
    if (rule.network && rule.network !== activeEnv) {
      throw new Error(`ネットワークの不一致: 対象ネットワークは ${rule.network} ですが、現在の環境は ${activeEnv} です。`);
    }

    // ======================================
    // 💰 手数料計算・徴収判定
    // ======================================
    const applyFee = shouldApplyFee(rule, activeEnv, false); // schedulerやapprovalからの呼び出しはManualフラグなし
    const feeConfig = rule.fee_config || DEFAULT_FEE_CONFIG;
    const { feeAmount, netAmount } = calculateFeeBreakdown(rule.amount, feeConfig);

    // ======================================
    // 🚧 実行パイプライン
    // ======================================
    console.log(`[ExecutionDriver] 実行開始: ${rule.name} (Amount: ${rule.amount}, applyFee: ${applyFee})`);

    // Dynamic import to avoid loading everything initially
    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();

    // 💰 手数料徴収ロジック（PTBに組み込み）
    let executionAmount = rule.amount;
    if (applyFee && feeAmount > 0) {
      console.log(`[ExecutionDriver] 手数料徴収をPTBに組み込みます: ${feeAmount} ${rule.source_token}`);
      const sourceToken = SUPPORTED_TOKENS.find(t => t.symbol === rule.source_token);
      if (sourceToken) {
        const rawFee = toRawAmount(feeAmount, sourceToken.decimals);
        const feeCoin = await extractInputCoin(tx, rule, sourceToken, activeAddress, activeEnv, Number(rawFee));
        tx.transferObjects([feeCoin], feeConfig.collector_address);
        executionAmount = netAmount; // 本処理に使う金額を差し引く
      }
    }

    // 🚀 Execution Strategy Branching
    if (activeEnv !== 'mainnet') {
      console.log(`[ExecutionDriver] ${activeEnv} 環境のため、ダミー送金(モック)を発行します。`);
      const [coin] = tx.splitCoins(tx.gas, [0]);
      tx.transferObjects([coin], activeAddress);
    } else {
      if (rule.strategy_type === 'deposit_to_navi') {
        console.log('[ExecutionDriver] Navi Protocol 連携の Deposit を試行します。');
        await buildNaviDepositPtb(tx, rule, activeAddress, activeEnv, executionAmount);
      } else {
        console.log('[ExecutionDriver] Cetus アグリゲーターを通したSwapを試行します。');
        await buildSwapPtb(tx, rule, activeAddress, activeEnv, executionAmount);
      }
    }

    // SDKサービス経由で実行（キーストアによるローカル署名）
    const result = await sdkService.executePtbAndReturnResult(
      tx,
      activeAddress,
      activeEnv,
      settings.sui_cli_path
    );

    if (result.status === 'success') {
      return {
        status: 'success',
        digest: result.digest,
        spentAmount: rule.amount,
        feeAmount: applyFee ? feeAmount : 0,
        netAmount: applyFee ? netAmount : rule.amount,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('[ExecutionDriver] タスク実行エラー:', error);
    return {
      status: 'failed',
      errorMessage: String(error),
      spentAmount: 0,
      feeAmount: 0,
      netAmount: 0,
    };
  }
}

/**
 * Cetus Aggregator を利用して PTB に Swap ロジックを組み込む
 */
async function buildSwapPtb(
  tx: any, 
  rule: AgentRule, 
  activeAddress: string, 
  activeEnv: string,
  amountInValue: number // 手数料控除後の金額
) {
  const { AggregatorClient } = await import('@cetusprotocol/aggregator-sdk');
  const BN = (await import('bn.js')).default;
  
  const sourceToken = SUPPORTED_TOKENS.find(t => t.symbol === rule.source_token);
  const targetToken = SUPPORTED_TOKENS.find(t => t.symbol === rule.target_token);

  if (!sourceToken || !targetToken) {
    throw new Error('未対応のトークンが指定されています。');
  }

  // 1. 金額の算出 (decimalsを考慮した絶対量)
  const amountToSwap = Math.floor(amountInValue * (10 ** sourceToken.decimals));
  
  // 2. Cetus Client 初期化
  const client = new AggregatorClient({}); // V3ではURL等は不要

  // 3. ルートの検索
  console.log(`[Cetus] ルート検索中... ${rule.source_token} -> ${rule.target_token} (Amount: ${amountToSwap})`);
  const routerData = await client.findRouters({
    from: sourceToken.coin_type as string,
    target: targetToken.coin_type as string,
    amount: new BN(amountToSwap),
    byAmountIn: true,
  });

  if (!routerData) {
    throw new Error('利用可能なスワップ経路(流動性)が見つかりませんでした。');
  }

  // 4. 入力コインの準備
  const inputCoinObject = await extractInputCoin(tx, rule, sourceToken, activeAddress, activeEnv, amountToSwap);

  // 5. ルーターSwapの組み立て
  const slippageValue = rule.max_slippage_bps / 10000; // 例: 100bps = 0.01 (1%)
  
  const targetCoin = await client.routerSwap({
    router: routerData,
    txb: tx,
    inputCoin: inputCoinObject,
    slippage: slippageValue,
  });

  // 6. 手に入れたトークンを自分のアドレスへ送信
  tx.transferObjects([targetCoin], activeAddress);
  
  console.log('[Cetus] Swap PTB 構築完了');
}

/**
 * Navi Protocol を利用して PTB に Deposit(預け入れ) ロジックを組み込む
 */
async function buildNaviDepositPtb(tx: any, rule: AgentRule, activeAddress: string, activeEnv: string, amountToDepositValue: number) {
  // 動的インポート（UI起動時のバンドルサイズ爆発を防ぐ）
  const { depositCoinPTB } = await import('@naviprotocol/lending');
  
  const sourceToken = SUPPORTED_TOKENS.find(t => t.symbol === rule.source_token);
  if (!sourceToken) {
    throw new Error('未対応のトークンが指定されています。');
  }

  // 金額の算出 
  const amountToDeposit = Math.floor(amountToDepositValue * (10 ** sourceToken.decimals));
  console.log(`[Navi] 預け入れ実行中... ${rule.source_token} (Amount: ${amountToDeposit})`);

  // 入力コインの準備（SUIまたは外部トークンのCoinMerge）
  const inputCoinObject = await extractInputCoin(tx, rule, sourceToken, activeAddress, activeEnv, amountToDeposit);

  // NaviのプールにDeposit
  await depositCoinPTB(
    tx,
    sourceToken.symbol as any, // 'SUI', 'USDC' などのシンボル
    inputCoinObject,
    { amount: amountToDeposit }
  );

  console.log('[Navi] Deposit PTB 構築完了');
}

/**
 * [共有ヘルパー] SUIまたはカスタムコインのアドレスから、必要額を結合・切り出す PTB コマンドを構築する
 */
async function extractInputCoin(tx: any, rule: AgentRule, sourceToken: any, activeAddress: string, activeEnv: string, amountToExtract: number) {
  if (rule.source_token === 'SUI') {
    // SUIの場合はガスから直接分割できる
    const [coin] = tx.splitCoins(tx.gas, [amountToExtract]);
    return coin;
  } else {
    // SUI以外のTokenであれば、ウォレット内の所持コインを結合して切り出す処理
    const coins = await sdkService.getCoinsByCoinType(activeAddress, activeEnv, sourceToken.coin_type);
    if (!coins || coins.length === 0) {
      throw new Error(`ウォレットに ${rule.source_token} がありません。`);
    }

    const totalBalance = coins.reduce((acc, c) => acc + BigInt(c.balance), BigInt(0));
    if (totalBalance < BigInt(amountToExtract)) {
      throw new Error(`残高不足: ${rule.source_token} が ${amountToExtract}（最小単位）必要ですが、${totalBalance} しかありません。`);
    }

    let inputCoin;
    if (coins.length === 1) {
      // 1枚しかない場合は、そこから直接切り出す
      [inputCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [amountToExtract]);
    } else {
      // 2枚以上ある場合は最初の一つ（BaseCoin）に残りすべてをマージする
      const baseCoinId = coins[0].coinObjectId;
      const otherCoinIds = coins.slice(1).map(c => tx.object(c.coinObjectId));
      
      tx.mergeCoins(tx.object(baseCoinId), otherCoinIds);
      // マージされたベースコインから必要額を切り出す
      [inputCoin] = tx.splitCoins(tx.object(baseCoinId), [amountToExtract]);
    }
    return inputCoin;
  }
}

/**
 * 実行結果から履歴オブジェクトを生成
 */
export function buildHistoryFromExecution(
  task: AgentTask,
  rule: AgentRule,
  result: ExecutionResult
): AgentHistory {
  return {
    id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    rule_id: rule.id,
    task_id: task.id,
    action_description: `${rule.amount} ${rule.source_token} を ${rule.target_token} へ変換`,
    status: result.status,
    tx_digest: result.digest,
    error_message: result.errorMessage,
    spent_amount: result.spentAmount, // 元本
    fee_amount: result.feeAmount,     // 手数料
    net_amount: result.netAmount,     // 実効額
    received_amount: 0, // 今は仮
  };
}
