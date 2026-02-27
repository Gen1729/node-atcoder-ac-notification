import * as https from 'https';
import * as zlib from 'zlib';
import { Submission } from './types';

/** AtCoder Problems API のベース URL */
const ATCODER_PROBLEMS_API_BASE = 'https://kenkoooo.com/atcoder/atcoder-api';

/**
 * AtCoder Problems API と通信するクライアントクラス。
 * Node.js 標準の https モジュールを使い、外部依存なしで HTTP リクエストを行う。
 */
export class AtCoderClient {
  /**
   * 指定ユーザーの提出一覧を AtCoder Problems API から取得する。
   *
   * @param userId   AtCoder のユーザー ID
   * @param fromSecond  この UNIX 秒以降の提出のみ返す（省略時は直近 24 時間）
   * @returns 提出オブジェクトの配列（該当なしの場合は空配列）
   */
  async fetchSubmissions(userId: string, fromSecond?: number): Promise<Submission[]> {
    // fromSecond が未指定の場合は「現在時刻 − 24時間」を起点とする
    const effectiveFromSecond = fromSecond ?? Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const url = new URL(
      `${ATCODER_PROBLEMS_API_BASE}/v3/user/submissions?user=${userId}&from_second=${effectiveFromSecond}`,
    );

    // kenkoooo.com は Bot 対策として素朴な Node.js User-Agent を弾く場合があるため、
    // ブラウザに近いヘッダーを付与して 403 を回避する
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        // gzip / deflate / br に対応することをサーバーへ伝える
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
    };

    return new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        const chunks: Buffer[] = [];

        // レスポンスボディをチャンク単位で収集する
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              // 全チャンクを結合して 1 つのバッファにまとめる
              let buffer = Buffer.concat(chunks);

              // Content-Encoding ヘッダーに応じてレスポンスボディを解凍する
              const encoding = response.headers['content-encoding'];
              if (encoding === 'gzip') {
                buffer = zlib.gunzipSync(buffer);
              } else if (encoding === 'deflate') {
                buffer = zlib.inflateSync(buffer);
              } else if (encoding === 'br') {
                buffer = zlib.brotliDecompressSync(buffer);
              }

              const submissions = JSON.parse(buffer.toString('utf-8')) as Submission[];
              resolve(submissions);
            } catch (error) {
              reject(new Error(`データの処理に失敗しました: ${error}`));
            }
          } else if (response.statusCode === 404) {
            // ユーザーが存在しない／指定期間に提出がない場合は空配列を返す
            resolve([]);
          } else {
            reject(
              new Error(`API リクエストが失敗しました: ステータスコード ${response.statusCode}`),
            );
          }
        });
      });

      request.on('error', (error) => {
        reject(new Error(`ネットワークエラー: ${error.message}`));
      });

      // 30 秒応答がなければタイムアウトとして扱い、接続を強制切断する
      request.setTimeout(30_000, () => {
        request.destroy();
        reject(new Error('リクエストがタイムアウトしました'));
      });

      request.end();
    });
  }

  /**
   * 提出一覧から AC（Accepted）のみを抽出して返す。
   * @param submissions フィルタリング前の提出一覧
   */
  filterAC(submissions: Submission[]): Submission[] {
    return submissions.filter((s) => s.result === 'AC');
  }

  /**
   * 提出一覧を epoch_second（提出時刻）の昇順にソートして返す。
   * 元の配列は破壊的に変更される点に注意。
   * @param submissions ソート対象の提出一覧
   */
  sortByTime(submissions: Submission[]): Submission[] {
    return submissions.sort((a, b) => a.epoch_second - b.epoch_second);
  }
}

