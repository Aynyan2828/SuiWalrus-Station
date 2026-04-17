// Navi Protocol 等の古いSDKが、最新の @mysten/sui v2 に切り替わった事によって
// 存在しなくなった "SuiClient" や "getFullnodeUrl" をインポートしようとして
// Vite(esbuild) がビルド段階でクラッシュするのを防ぐためのダミー（ポリフィル）ファイルです。

// 最新のクライアントからの再エクスポートを無効化（内部参照エラー防止のため）
// export * from '@mysten/sui/dist/client/index.mjs';

// 古いライブラリ（Navi等）が期待しているが、v2には無いクラスや関数をモックとして追加
export class SuiClient {
  constructor() {
    console.warn('[Shim] 互換性用のダミー SuiClient が初期化されました。');
  }
}

export function getFullnodeUrl(network: string) {
  return `https://fullnode.${network}.sui.io`;
}
