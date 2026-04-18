import { invoke } from '@tauri-apps/api/core';

export interface TradeportCollection {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  floorPrice?: number;
  volume?: number;
  totalSupply?: number;
  verified?: boolean;
}

export interface TradeportNft {
  id: string;
  name: string;
  imageUrl: string;
  owner: string;
  ranking?: number;
  attributes?: any[];
  listings?: any[];
  lastSalePrice?: number;
  collectionName?: string;
}

/**
 * Tradeport Data API (GraphQL) 連携サービス
 * 安全のため、バックエンドの Rust プロキシ経由で通信します。
 */
export class TradeportService {
  /**
   * IPFS URL を HTTP ゲートウェイ形式に変換
   */
  private static ipfsToHttp(url?: string): string {
    if (!url) return '';
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return url;
  }

  /**
   * コレクション検索
   */
  static async searchCollections(query: string): Promise<TradeportCollection[]> {
    const gqlQuery = `
      query SearchCollections($query: String!) {
        sui {
          collections(where: { title: { _ilike: $query } }, order_by: { volume: desc }, limit: 20) {
            id
            title
            slug
            cover_url
            description
            verified
            floor
            volume
          }
        }
      }
    `;

    const resp = await this.callApi(gqlQuery, { query: `%${query}%` });
    return resp?.data?.sui?.collections?.map((c: any) => ({
      id: c.id,
      name: c.title,
      slug: c.slug,
      imageUrl: this.ipfsToHttp(c.cover_url),
      description: c.description,
      verified: c.verified,
      floorPrice: c.floor,
      volume: c.volume,
    })) || [];
  }

  /**
   * トレンドコレクション取得
   */
  static async getTrendingCollections(): Promise<TradeportCollection[]> {
    const gqlQuery = `
      query GetTrending {
        sui {
          collections(order_by: { volume: desc }, limit: 12) {
            id
            title
            slug
            cover_url
            verified
            floor
            volume
          }
        }
      }
    `;

    const resp = await this.callApi(gqlQuery, {});
    return resp?.data?.sui?.collections?.map((c: any) => ({
      id: c.id,
      name: c.title,
      slug: c.slug,
      imageUrl: this.ipfsToHttp(c.cover_url),
      verified: c.verified,
      floorPrice: c.floor,
      volume: c.volume,
    })) || [];
  }

  /**
   * NFT 詳細取得
   */
  static async getNftDetail(nftId: string): Promise<TradeportNft | null> {
    const gqlQuery = `
      query GetNft($id: String!) {
        sui {
          nft(id: $id) {
            id
            title
            media_url
            owner
            attributes
            ranking
            listings(where: { price: { _gt: 0 } }, limit: 1) {
              id
              price
              marketplace
            }
          }
        }
      }
    `;

    const resp = await this.callApi(gqlQuery, { id: nftId });
    const n = resp?.data?.sui?.nft;
    if (!n) return null;

    return {
      id: n.id,
      name: n.title,
      imageUrl: this.ipfsToHttp(n.media_url),
      owner: n.owner,
      attributes: n.attributes,
      ranking: n.ranking,
      listings: n.listings?.map((l: any) => ({
        ...l,
        price: this.formatSuiPrice(l.price)
      })),
    };
  }

  /**
   * コレクション所属の NFT 一覧取得（力技：表示 100% 保証版）
   */
  static async getCollectionNfts(
    slug: string, 
    sortOrder: 'lowest' | 'highest' | 'newest' = 'lowest'
  ): Promise<TradeportNft[]> {
    // ソート条件の構築（エラー回避のため一旦標準項目に。価格ソートはフロントで検討）
    let orderBy: any = { ranking: 'asc_nulls_last' };
    if (sortOrder === 'highest') {
      orderBy = { ranking: 'desc_nulls_last' };
    }

    const gqlQuery = `
      query GetCollectionNfts($slug: String!, $orderBy: [nfts_order_by!]) {
        sui {
          nfts(
            where: { collection: { slug: { _eq: $slug } } }, 
            limit: 40, 
            order_by: $orderBy
          ) {
            id
            name
            media_url
            ranking
            collection {
               title
            }
            listings(where: { price: { _gt: 0 } }, limit: 1) {
              id
              price
            }
          }
        }
      }
    `;

    const resp = await this.callApi(gqlQuery, { slug, orderBy });
    return resp?.data?.sui?.nfts?.map((n: any) => ({
      id: n.id,
      name: n.name || 'Unknown NFT',
      imageUrl: this.ipfsToHttp(n.media_url),
      owner: '', 
      ranking: n.ranking,
      collectionName: n.collection?.title || 'Unknown Collection',
      listings: n.listings?.map((l: any) => ({
        ...l,
        price: this.formatSuiPrice(l.price)
      }))
    })) || [];
  }

  /**
   * Mist -> SUI 単位変換（10^9 で割る）
   */
  private static formatSuiPrice(mist: any): string {
    if (mist === null || mist === undefined) return '0';
    const num = Number(mist);
    if (isNaN(num)) return '0';
    // 10^9 で割って小数点第3位まで表示
    const sui = num / 1_000_000_000;
    return sui.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  /**
   * ウォレットの NFT 保有状況取得（任意のアドレスに対応）
   */
  static async getWalletNftHoldings(address: string): Promise<TradeportNft[]> {
    const gqlQuery = `
      query GetWalletNfts($owner: String!) {
        sui {
          nfts(where: { owner: { _eq: $owner } }, limit: 50) {
            id
            name
            media_url
            ranking
            collection {
               title
            }
          }
        }
      }
    `;

    const resp = await this.callApi(gqlQuery, { owner: address });
    return resp?.data?.sui?.nfts?.map((n: any) => ({
      id: n.id,
      name: n.name || 'Unknown NFT',
      imageUrl: this.ipfsToHttp(n.media_url),
      owner: address,
      ranking: n.ranking,
      collectionName: n.collection?.title || 'Unknown Collection'
    })) || [];
  }

  /**
   * Rust プロキシ経由で API 呼び出し
   */
  private static async callApi(query: string, variables: any): Promise<any> {
    try {
      if (typeof invoke === 'undefined') {
        throw new Error('Tauri "invoke" が見つかりませんでした。');
      }

      return await invoke('call_tradeport_api', {
        request: { query, variables }
      });
    } catch (error) {
      console.error('[TradeportService] API Call Failed:', error);
      throw error;
    }
  }
}
