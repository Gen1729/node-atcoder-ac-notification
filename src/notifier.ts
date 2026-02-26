import { format } from 'date-fns';
import { ACNotification, Notifier } from './types';

/**
 * ターミナルに通知を表示する実装
 */
export class ConsoleNotifier implements Notifier {
  notify(notification: ACNotification): void {
    const timestamp = format(notification.timestamp, 'yyyy-MM-dd HH:mm:ss');
    const message = `${timestamp} ${notification.userId} AC:${notification.contestId} ${notification.problemId} point:${notification.point} (${notification.language})`;
    
    console.log(message);
  }
}

/**
 * 複数の Notifier をまとめて実行する
 */
export class MultiNotifier implements Notifier {
  private notifiers: Notifier[];

  constructor(notifiers: Notifier[]) {
    this.notifiers = notifiers;
  }

  async notify(notification: ACNotification): Promise<void> {
    const promises = this.notifiers.map(async (notifier) => {
      try {
        await notifier.notify(notification);
      } catch (error) {
        console.error(`通知の送信に失敗しました: ${error}`);
      }
    });

    await Promise.all(promises);
  }
}

// 将来的な拡張例:
// export class LineNotifier implements Notifier {
//   constructor(private accessToken: string) {}
//   
//   async notify(notification: ACNotification): Promise<void> {
//     // LINE Notify API を使って通知を送信
//   }
// }
