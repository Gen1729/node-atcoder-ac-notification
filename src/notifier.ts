import { format } from 'date-fns';
import { ACNotification, Notifier } from './types';

/**
 * AC 通知をターミナル（標準出力）へ 1 行で出力する通知クラス。
 *
 * 出力フォーマット例:
 *   2026-02-27 09:00:00 tourist AC:abc300 abc300_a point:100 (C++ 23 (gcc 12.2))
 */
export class ConsoleNotifier implements Notifier {
  notify(notification: ACNotification): void {
    // date-fns の format で Date オブジェクトを読みやすい文字列に変換する
    const timestamp = format(notification.timestamp, 'yyyy-MM-dd HH:mm:ss');
    const message =
      `${timestamp} ${notification.userId} AC:${notification.contestId}` +
      ` ${notification.problemId} point:${notification.point} (${notification.language})`;

    console.log(message);
  }
}

/**
 * 複数の Notifier を 1 つにまとめ、すべてに対して並列で通知を送るクラス。
 *
 * 使用例:
 *   const notifier = new MultiNotifier([new ConsoleNotifier(), new LineNotifier(token)]);
 *   await notifier.notify(notification);
 *
 * 一部の Notifier が失敗しても他の Notifier への通知は継続する。
 */
export class MultiNotifier implements Notifier {
  /** 通知先の Notifier 一覧（コンストラクタ後に変更しない想定） */
  private readonly notifiers: Notifier[];

  constructor(notifiers: Notifier[]) {
    this.notifiers = notifiers;
  }

  async notify(notification: ACNotification): Promise<void> {
    // 全 Notifier を並列実行し、個別のエラーはログのみで握りつぶす
    await Promise.all(
      this.notifiers.map(async (notifier) => {
        try {
          await notifier.notify(notification);
        } catch (error) {
          console.error(`通知の送信に失敗しました: ${error}`);
        }
      }),
    );
  }
}

// =============================================================================
// Discord 通知
// =============================================================================

/**
 * Discord の Incoming Webhook を使って AC 通知を送る通知クラス。
 *
 * Webhook URL は環境変数 DISCORD_WEBHOOK_URL から取得する。
 * URL が設定されていない場合は警告を出して何もしない（他の Notifier は継続動作する）。
 *
 * Discord メッセージ例:
 *   ✅ **tourist** が **abc390_c** を AC！
 *   コンテスト: abc390 | 300点 | C++ 23 (gcc 12.2)
 *   https://atcoder.jp/contests/abc390/submissions/12345678
 */
export class DiscordNotifier implements Notifier {
  private readonly webhookUrl: string | undefined;

  constructor() {
    // 環境変数から Webhook URL を読み込む（GitHub Actions Secrets や .env で設定）
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  async notify(notification: ACNotification): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('[DiscordNotifier] DISCORD_WEBHOOK_URL が設定されていないためスキップします');
      return;
    }

    const submissionUrl =
      `https://atcoder.jp/contests/${notification.contestId}/submissions/${notification.submissionId}`;

    // Discord の Embed（リッチメッセージ）形式で送信する
    const body = JSON.stringify({
      embeds: [
        {
          // タイトル行: クリックするとサブミッションページに飛ぶ
          title: `✅ ${notification.userId} が ${notification.problemId} を AC！`,
          url: submissionUrl,
          color: 0x00c000, // 緑色
          fields: [
            { name: 'コンテスト', value: notification.contestId, inline: true },
            { name: '配点',       value: `${notification.point}点`,  inline: true },
            { name: '言語',       value: notification.language,       inline: true },
          ],
          // フッターに提出時刻を表示（Discord が自動でローカル時刻に変換して表示する）
          timestamp: notification.timestamp.toISOString(),
        },
      ],
    });

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    // 204 No Content が正常レスポンス。それ以外はエラーとして投げる
    if (!response.ok && response.status !== 204) {
      throw new Error(`Discord Webhook への送信に失敗しました: HTTP ${response.status}`);
    }
  }
}

// =============================================================================
// 拡張例（必要に応じて追加してください）
// =============================================================================
//
// export class LineNotifier implements Notifier {
//   constructor(private readonly accessToken: string) {}
//
//   async notify(notification: ACNotification): Promise<void> {
//     // LINE Notify API（https://notify-api.line.me/api/notify）へ POST する
//   }
// }
