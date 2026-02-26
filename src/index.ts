import * as cron from 'node-cron';
import { loadConfig } from './config';
import { StateStore } from './stateStore';
import { AtCoderClient } from './atcoderClient';
import { ConsoleNotifier } from './notifier';
import { ACNotification, Submission } from './types';

/**
 * メインの監視ロジック
 */
class ACMonitor {
  private config = loadConfig();
  private stateStore = new StateStore();
  private atcoderClient = new AtCoderClient();
  private notifier = new ConsoleNotifier();
  private isRunning = false;

  /**
   * 監視を開始する
   */
  async start(): Promise<void> {
    console.log('=== AtCoder AC 監視を開始します ===');
    console.log(`監視対象ユーザー: ${this.config.users.join(', ')}`);
    
    if (this.config.users.length === 0) {
      console.error('エラー: 監視対象ユーザーが設定されていません');
      console.error('config.json に users を追加してください');
      return;
    }

    // スケジュールモードかポーリングモードかを判定
    if (this.config.scheduleTimes && this.config.scheduleTimes.length > 0) {
      await this.startScheduledMode();
    } else if (this.config.pollingIntervalSeconds) {
      await this.startPollingMode();
    } else {
      console.error('エラー: scheduleTimes または pollingIntervalSeconds のいずれかを設定してください');
      return;
    }
  }

  /**
   * スケジュールモードで監視を開始
   */
  private async startScheduledMode(): Promise<void> {
    console.log('=== スケジュールモードで起動 ===');
    console.log(`実行スケジュール: ${this.config.scheduleTimes!.join(', ')}`);
    console.log('');

    this.isRunning = true;

    // 終了シグナルのハンドリング
    process.on('SIGINT', () => {
      console.log('');
      console.log('=== 監視を終了します ===');
      this.isRunning = false;
      process.exit(0);
    });

    // 各スケジュール時刻に対してcronジョブを設定
    for (const scheduleTime of this.config.scheduleTimes!) {
      const cronExpression = this.convertToCronExpression(scheduleTime);
      
      cron.schedule(cronExpression, async () => {
        if (this.isRunning) {
          console.log(`\n[${new Date().toLocaleString('ja-JP')}] スケジュール実行開始`);
          await this.checkAllUsers();
          console.log(`[${new Date().toLocaleString('ja-JP')}] スケジュール実行完了\n`);
        }
      }, {
        timezone: 'Asia/Tokyo'
      });

      console.log(`✓ ${scheduleTime} にスケジュール設定完了`);
    }

    console.log('\nスケジューラーが起動しました。終了するには Ctrl+C を押してください。');
    
    // プロセスを維持
    await new Promise(() => {});
  }

  /**
   * ポーリングモードで監視を開始（従来の動作）
   */
  private async startPollingMode(): Promise<void> {
    console.log('=== ポーリングモードで起動 ===');
    console.log(`ポーリング間隔: ${this.config.pollingIntervalSeconds} 秒`);
    console.log('');

    this.isRunning = true;

    // 終了シグナルのハンドリング
    process.on('SIGINT', () => {
      console.log('');
      console.log('=== 監視を終了します ===');
      this.isRunning = false;
      process.exit(0);
    });

    // メインループ
    while (this.isRunning) {
      await this.checkAllUsers();
      await this.sleep(this.config.pollingIntervalSeconds! * 1000);
    }
  }

  /**
   * 時刻文字列（HH:mm）をcron式に変換
   */
  private convertToCronExpression(timeStr: string): string {
    // cron形式かどうかをチェック（5つ以上のスペース区切りフィールドがある場合）
    if (timeStr.includes(' ') && timeStr.split(' ').length >= 5) {
      return timeStr;  // 既にcron形式
    }

    // HH:mm形式の場合
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      console.warn(`警告: 無効な時刻形式: ${timeStr}。デフォルトで9:00として扱います。`);
      return '0 9 * * *';
    }

    const [, hour, minute] = match;
    // cron形式: 分 時 日 月 曜日
    return `${minute} ${hour} * * *`;
  }

  /**
   * 全ユーザーをチェック
   */
  private async checkAllUsers(): Promise<void> {
    for (const userId of this.config.users) {
      try {
        await this.checkUser(userId);
      } catch (error) {
        console.error(`[${userId}] エラーが発生しました: ${error}`);
        console.error(`${this.config.retryDelaySeconds} 秒後にリトライします...`);
        await this.sleep(this.config.retryDelaySeconds * 1000);
      }
    }
  }

  /**
   * 特定のユーザーをチェック
   */
  private async checkUser(userId: string): Promise<void> {
    const lastChecked = this.stateStore.getLastChecked(userId);
    
    // API から提出を取得
    const submissions = await this.atcoderClient.fetchSubmissions(
      userId,
      lastChecked > 0 ? lastChecked : undefined
    );

    if (submissions.length === 0) {
      return;
    }

    // 時系列順にソート
    const sortedSubmissions = this.atcoderClient.sortByTime(submissions);

    // AC のみフィルタリング
    const acSubmissions = this.atcoderClient.filterAC(sortedSubmissions);

    // 新規 AC を検出して通知
    for (const submission of acSubmissions) {
      await this.processACSubmission(submission);
    }

    // 最終チェック時刻を更新（最新の提出の時刻）
    const latestSubmission = sortedSubmissions[sortedSubmissions.length - 1];
    this.stateStore.updateLastChecked(userId, latestSubmission.epoch_second);
  }

  /**
   * AC 提出を処理
   */
  private async processACSubmission(submission: Submission): Promise<void> {
    const { user_id, problem_id, contest_id, language, id, epoch_second, point } = submission;

    // 既に AC 済みの問題かチェック
    if (this.stateStore.isSolved(user_id, problem_id)) {
      return;
    }

    // AC 済みとしてマーク
    this.stateStore.markAsSolved(user_id, problem_id);

    // 通知
    const notification: ACNotification = {
      timestamp: new Date(epoch_second * 1000),
      userId: user_id,
      contestId: contest_id,
      problemId: problem_id,
      language: language,
      submissionId: id,
      point: point,
    };

    await this.notifier.notify(notification);
  }

  /**
   * 指定時間スリープ
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * エントリーポイント
 */
async function main() {
  try {
    const monitor = new ACMonitor();
    await monitor.start();
  } catch (error) {
    console.error('予期しないエラーが発生しました:', error);
    process.exit(1);
  }
}

// プログラムを実行
main();
