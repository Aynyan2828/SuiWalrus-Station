// ==========================================
// Sui SDK サービス（Application / Service 層）
// GUI から呼ばれるビジネスロジック。
// エラーハンドリングを日本語で統一。
// ==========================================
import { getClient, testRpcConnection } from './sui-sdk-client';
import { getKeypairForAddress } from './signer-provider';
import { Transaction } from '@mysten/sui/transactions';

// ==========================================
// 型定義
// ==========================================
export interface SdkAccountInfo {
  address: string;
  network: string;
  balanceSui: string;
  balanceMist: string;
  rpcUrl: string;
  rpcOk: boolean;
  rpcLatencyMs: number;
}

export interface SdkGasCoin {
  coinObjectId: string;
  balance: string;
  version: string;
  digest: string;
}

export interface SdkOwnedObject {
  objectId: string;
  type: string;
  owner: string;
  version: string;
  digest: string;
}

export interface SdkObjectDetail {
  objectId: string;
  type: string;
  owner: string;
  version: string;
  digest: string;
  content: unknown;
  display?: Record<string, string>;
  rawJson: string;
}

export interface SdkTxResult {
  digest: string;
  status: string;
  error?: string;
  gasUsed?: string;
  rawJson: string;
}

// ==========================================
// ヘルパー
// ==========================================
function parseOwner(owner: unknown): string {
  if (!owner) return 'unknown';
  if (typeof owner === 'string') return owner;
  if (typeof owner === 'object') {
    const o = owner as Record<string, unknown>;
    if ('AddressOwner' in o) return String(o.AddressOwner);
    if ('ObjectOwner' in o) return String(o.ObjectOwner);
    if ('Shared' in o) return 'Shared';
  }
  return JSON.stringify(owner);
}

// ==========================================
// 読み取り系
// ==========================================

export async function getAccountInfo(address: string, envName: string): Promise<SdkAccountInfo> {
  try {
    const client = getClient(envName);
    const rpcTest = await testRpcConnection(envName);
    const balance = await client.getBalance({ owner: address });
    const totalMist = BigInt(balance.totalBalance);
    const suiAmount = Number(totalMist) / 1_000_000_000;

    return {
      address,
      network: envName,
      balanceSui: suiAmount.toFixed(9).replace(/\.?0+$/, ''),
      balanceMist: totalMist.toString(),
      rpcUrl: rpcTest.ok ? '接続中' : '切断',
      rpcOk: rpcTest.ok,
      rpcLatencyMs: rpcTest.latencyMs,
    };
  } catch (e) {
    throw new Error(`アカウント情報の取得に失敗しました: ${e}`);
  }
}

export async function getGasCoins(address: string, envName: string): Promise<SdkGasCoin[]> {
  try {
    const client = getClient(envName);
    const coins = await client.getCoins({ owner: address, coinType: '0x2::sui::SUI' });
    return coins.data.map((c: any) => ({
      coinObjectId: c.coinObjectId,
      balance: (Number(BigInt(c.balance)) / 1_000_000_000).toFixed(9).replace(/\.?0+$/, ''),
      version: c.version,
      digest: c.digest,
    }));
  } catch (e) {
    throw new Error(`ガスコイン一覧の取得に失敗しました: ${e}`);
  }
}

export async function getCoinsByCoinType(address: string, envName: string, coinType: string): Promise<any[]> {
  try {
    const client = getClient(envName);
    const coins = await client.getCoins({ owner: address, coinType });
    return coins.data; // 生のCoinデータを返す（PTBで再利用するため）
  } catch (e) {
    throw new Error(`コイン一覧(${coinType})の取得に失敗しました: ${e}`);
  }
}

export async function getOwnedObjects(
  address: string,
  envName: string,
  cursor?: string
): Promise<{ objects: SdkOwnedObject[]; nextCursor: string | null | undefined; hasMore: boolean }> {
  try {
    const client = getClient(envName);
    const res = await client.getOwnedObjects({
      owner: address,
      options: { showType: true, showOwner: true },
      cursor: cursor || undefined,
      limit: 50,
    });

    const objects = res.data
      .filter((o: any) => o.data)
      .map((o: any) => ({
        objectId: o.data.objectId,
        type: o.data.type || 'unknown',
        owner: parseOwner(o.data.owner),
        version: o.data.version,
        digest: o.data.digest,
      }));

    return { objects, nextCursor: res.nextCursor, hasMore: res.hasNextPage };
  } catch (e) {
    throw new Error(`オブジェクト一覧の取得に失敗しました: ${e}`);
  }
}

export async function getObjectDetail(objectId: string, envName: string): Promise<SdkObjectDetail> {
  try {
    const client = getClient(envName);
    const res = await client.getObject({
      id: objectId,
      options: { showContent: true, showOwner: true, showType: true, showDisplay: true },
    });

    if (!res.data) throw new Error(`オブジェクト ${objectId} が見つかりません。`);
    const d = res.data as any;
    return {
      objectId: d.objectId,
      type: d.type || 'unknown',
      owner: parseOwner(d.owner),
      version: d.version,
      digest: d.digest,
      content: d.content,
      display: d.display?.data || undefined,
      rawJson: JSON.stringify(res, null, 2),
    };
  } catch (e) {
    throw new Error(`オブジェクト詳細の取得に失敗しました: ${e}`);
  }
}

// ==========================================
// 書き込み系
// ==========================================

export async function transferSui(
  fromAddress: string,
  toAddress: string,
  amountSui: number,
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const keypair = await getKeypairForAddress(fromAddress, keystorePath);
    const amountMist = BigInt(Math.floor(amountSui * 1_000_000_000));

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [amountMist]);
    tx.transferObjects([coin], toAddress);

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      gasUsed: effects?.gasUsed
        ? `${(Number(BigInt(effects.gasUsed.computationCost) + BigInt(effects.gasUsed.storageCost)) / 1_000_000_000).toFixed(6)} SUI`
        : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`SUI 送信に失敗しました: ${e}`);
  }
}

export async function transferObject(
  fromAddress: string,
  toAddress: string,
  objectId: string,
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const keypair = await getKeypairForAddress(fromAddress, keystorePath);

    const tx = new Transaction();
    tx.transferObjects([tx.object(objectId)], toAddress);

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`オブジェクト転送に失敗しました: ${e}`);
  }
}

export async function executeMoveCall(
  address: string,
  params: {
    packageId: string;
    module: string;
    fn: string;
    typeArgs: string[];
    args: string[];
    gasBudget?: number;
  },
  envName: string,
  dryRun: boolean = false,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const tx = new Transaction();

    tx.moveCall({
      target: `${params.packageId}::${params.module}::${params.fn}`,
      typeArguments: params.typeArgs.filter(t => t.trim()),
      arguments: params.args.map(a => {
        if (/^\d+$/.test(a.trim())) return tx.pure.u64(BigInt(a.trim()));
        if (a.trim() === 'true' || a.trim() === 'false') return tx.pure.bool(a.trim() === 'true');
        if (a.trim().startsWith('0x')) return tx.object(a.trim());
        return tx.pure.string(a.trim());
      }),
    });

    if (params.gasBudget) tx.setGasBudget(params.gasBudget);

    if (dryRun) {
      tx.setSender(address);
      const built = await tx.build({ client });
      const dryResult = await client.dryRunTransactionBlock({ transactionBlock: built });
      const effects = (dryResult as any).effects;
      return {
        digest: '(dry-run)',
        status: effects?.status?.status || 'unknown',
        error: effects?.status?.error,
        rawJson: JSON.stringify(dryResult, null, 2),
      };
    }

    const keypair = await getKeypairForAddress(address, keystorePath);
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`Move Call の実行に失敗しました: ${e}`);
  }
}

/**
 * 汎用の PTB (Transaction) を実行して結果を返す（AI Agent用など）
 */
export async function executePtbAndReturnResult(
  tx: typeof Transaction.prototype,
  address: string,
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const keypair = await getKeypairForAddress(address, keystorePath);

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`PTB の実行に失敗しました: ${e}`);
  }
}

// ==========================================
// トランザクション履歴
// ==========================================

export interface SdkTxHistoryEntry {
  digest: string;
  timestampMs: string;
  status: string;
  sender: string;
  gasUsed: string;
  kind: string;
  checkpoint: string;
}

export async function getTransactionHistory(
  address: string,
  envName: string,
  cursor?: string,
  limit: number = 20,
): Promise<{ transactions: SdkTxHistoryEntry[]; nextCursor: string | null; hasMore: boolean }> {
  try {
    const client = getClient(envName);
    const res = await client.queryTransactionBlocks({
      filter: { FromAddress: address },
      options: { showEffects: true, showInput: true },
      cursor: cursor || undefined,
      limit,
      order: 'descending',
    });

    const transactions: SdkTxHistoryEntry[] = res.data.map((tx: any) => {
      const effects = tx.effects as any;
      const status = effects?.status?.status || 'unknown';
      const gasUsed = effects?.gasUsed
        ? `${(Number(BigInt(effects.gasUsed.computationCost || '0') + BigInt(effects.gasUsed.storageCost || '0')) / 1_000_000_000).toFixed(6)}`
        : '0';
      const kind = tx.transaction?.data?.transaction?.kind || 'unknown';

      return {
        digest: tx.digest,
        timestampMs: tx.timestampMs || '0',
        status,
        sender: tx.transaction?.data?.sender || address,
        gasUsed,
        kind: typeof kind === 'string' ? kind : 'ProgrammableTransaction',
        checkpoint: tx.checkpoint || '',
      };
    });

    return {
      transactions,
      nextCursor: res.nextCursor || null,
      hasMore: res.hasNextPage,
    };
  } catch (e) {
    throw new Error(`トランザクション履歴の取得に失敗しました: ${e}`);
  }
}

// ==========================================
// ステーキング (SUI Staking)
// ==========================================

export async function getStakes(address: string, envName: string) {
  try {
    const client = getClient(envName);
    const stakes = await client.getStakes({ owner: address });
    return stakes;
  } catch (e) {
    throw new Error(`ステーキング情報の取得に失敗しました: ${e}`);
  }
}

export async function getValidators(envName: string) {
  try {
    const client = getClient(envName);
    // システム状態とAPY情報を並列で取得
    const [state, apyData] = await Promise.all([
      client.getLatestSuiSystemState(),
      client.getValidatorsApy(),
    ]);

    const validators = state.activeValidators;

    // APY データをマージ
    return validators.map((v: any) => {
      const apyInfo = apyData.apys.find((a: any) => a.address === v.suiAddress);
      return {
        ...v,
        apy: apyInfo ? apyInfo.apy : 0,
      };
    });
  } catch (e) {
    throw new Error(`バリデーター情報の取得に失敗しました: ${e}`);
  }
}

export async function requestAddStake(
  address: string,
  validatorAddress: string,
  amountInMist: bigint,
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const tx = new Transaction();

    // ガスから指定金額のコインを切り出す
    const stakeCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);

    // 0x3::sui_system::request_add_stake を呼び出し
    tx.moveCall({
      target: '0x3::sui_system::request_add_stake',
      arguments: [
        tx.object('0x5'), // SuiSystemState object
        stakeCoin,
        tx.pure.address(validatorAddress),
      ],
    });

    const keypair = await getKeypairForAddress(address, keystorePath);
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`ステーキングの実行に失敗しました: ${e}`);
  }
}

export async function requestWithdrawStake(
  address: string,
  stakedSuiObjectId: string,
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const tx = new Transaction();

    // 0x3::sui_system::request_withdraw_stake を呼び出し
    tx.moveCall({
      target: '0x3::sui_system::request_withdraw_stake',
      arguments: [
        tx.object('0x5'), // SuiSystemState object
        tx.object(stakedSuiObjectId),
      ],
    });

    const keypair = await getKeypairForAddress(address, keystorePath);
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`アンステークの実行に失敗しました: ${e}`);
  }
}

// ==========================================
// コイン操作 (Merge / Split)
// ==========================================

export async function requestMergeCoins(
  address: string,
  primaryCoinId: string,
  coinIdsToMerge: string[],
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const tx = new Transaction();

    // 複数のコインを primaryCoin にマージする
    tx.mergeCoins(
      tx.object(primaryCoinId),
      coinIdsToMerge.map(id => tx.object(id))
    );

    const keypair = await getKeypairForAddress(address, keystorePath);
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`コインの統合に失敗しました: ${e}`);
  }
}

export async function requestSplitCoin(
  address: string,
  coinId: string,
  amountInMist: bigint,
  envName: string,
  keystorePath?: string,
): Promise<SdkTxResult> {
  try {
    const client = getClient(envName);
    const tx = new Transaction();

    // 指定したコインから指定金額を切り出して、新しいコインとして転送する
    const topCoin = tx.splitCoins(tx.object(coinId), [tx.pure.u64(amountInMist)]);
    tx.transferObjects([topCoin], tx.pure.address(address));

    const keypair = await getKeypairForAddress(address, keystorePath);
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    const effects = result.effects as any;
    const status = effects?.status?.status || 'unknown';
    return {
      digest: result.digest,
      status,
      error: status === 'failure' ? effects?.status?.error : undefined,
      rawJson: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    throw new Error(`コインの分割に失敗しました: ${e}`);
  }
}
