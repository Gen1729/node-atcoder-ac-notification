import * as https from 'https';
import { Submission } from './types';

const ATCODER_PROBLEMS_API_BASE = 'https://kenkoooo.com/atcoder/atcoder-api';

export class AtCoderClient {
  /**
   * ユーザーの提出を取得する
   * @param userId AtCoder のユーザー ID
   * @param fromSecond この UNIX 時刻以降の提出のみ取得（オプション）
   */
  async fetchSubmissions(userId: string, fromSecond?: number): Promise<Submission[]> {
    const url = fromSecond
      ? `${ATCODER_PROBLEMS_API_BASE}/v3/user/submissions?user=${userId}&from_second=${fromSecond}`
      : `${ATCODER_PROBLEMS_API_BASE}/v3/user/submissions?user=${userId}`;

    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        let data = '';

        // データの受信
        response.on('data', (chunk) => {
          data += chunk;
        });

        // 受信完了
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const submissions = JSON.parse(data) as Submission[];
              resolve(submissions);
            } catch (error) {
              reject(new Error(`JSON のパースに失敗しました: ${error}`));
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
