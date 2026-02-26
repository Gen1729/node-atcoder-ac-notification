import * as https from 'https';
import * as zlib from 'zlib';
import { Submission } from './types';

const ATCODER_PROBLEMS_API_BASE = 'https://kenkoooo.com/atcoder/atcoder-api';

export class AtCoderClient {
  /**
   * ユーザーの提出を取得する
   * @param userId AtCoder のユーザー ID
   * @param fromSecond この UNIX 時刻以降の提出のみ取得（オプション）
   */
  async fetchSubmissions(userId: string, fromSecond?: number): Promise<Submission[]> {
    // from_second が指定されていない場合は、現在時刻（プログラム起動時）−1日から取得
    const defaultFromSecond = fromSecond || Math.floor(Date.now() / 1000) - 24*60*60;
    
    const url = new URL(
      `${ATCODER_PROBLEMS_API_BASE}/v3/user/submissions?user=${userId}&from_second=${defaultFromSecond}`
    );

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
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

        // データの受信
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        // 受信完了
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              // バッファを結合
              let buffer = Buffer.concat(chunks);

              // gzip圧縮されている場合は解凍
              const encoding = response.headers['content-encoding'];
              if (encoding === 'gzip') {
                buffer = zlib.gunzipSync(buffer);
              } else if (encoding === 'deflate') {
                buffer = zlib.inflateSync(buffer);
              } else if (encoding === 'br') {
                buffer = zlib.brotliDecompressSync(buffer);
              }

              const data = buffer.toString('utf-8');
              const submissions = JSON.parse(data) as Submission[];
              resolve(submissions);
            } catch (error) {
              reject(new Error(`データの処理に失敗しました: ${error}`));
            }
          } else if (response.statusCode === 404) {
            // ユーザーが存在しない、または提出がない場合
            resolve([]);
          } else {
            reject(
              new Error(
                `API リクエストが失敗しました: ステータスコード ${response.statusCode}`
              )
            );
          }
        });
      });

      // エラーハンドリング
      request.on('error', (error) => {
        reject(new Error(`ネットワークエラー: ${error.message}`));
      });

      // タイムアウト設定（30秒）
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('リクエストがタイムアウトしました'));
      });

      // リクエストを送信
      request.end();
    });
  }

  /**
   * AC（正解）の提出のみをフィルタリング
   */
  filterAC(submissions: Submission[]): Submission[] {
    return submissions.filter((submission) => submission.result === 'AC');
  }

  /**
   * 提出を epoch_second で昇順にソート
   */
  sortByTime(submissions: Submission[]): Submission[] {
    return submissions.sort((a, b) => a.epoch_second - b.epoch_second);
  }
}
