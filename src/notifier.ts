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
// 拡張例（将来的に追加したい Notifier のテンプレート）
// =============================================================================
//
// export class LineNotifier implements Notifier {
//   constructor(private readonly accessToken: string) {}
//
//   async notify(notification: ACNotification): Promise<void> {
//     // LINE Notify API（https://notify-api.line.me/api/notify）へ POST する
//   }
// }
