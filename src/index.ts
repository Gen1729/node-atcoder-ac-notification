import cron from 'node-cron';
import { loadConfig } from './config';
import { StateStore } from './stateStore';
import { AtCoderClient } from './atcoderClient';
import { ConsoleNotifier } from './notifier';
import { ACNotification, Submission } from './types';

/**
 * AtCoder の AC 提出を監視し、新規 AC を通知するメインクラス。
 *
 * 動作モード:
 *   - スケジュールモード: config.scheduleTimes に時刻を指定し、その時刻に定期実行
 *   - ポーリングモード  : config.pollingIntervalSeconds を指定し、一定間隔でループ実行
 */
class ACMonitor {
  private readonly config = loadConfig();
  private readonly stateStore = new StateStore();
  private readonly atcoderClient = new AtCoderClient();
  private readonly notifier = new ConsoleNotifier();

  /** 実行中フラグ（SIGINT 受信時に false にしてループを終了させる） */
  private isRunning = false;

  /**
   * 設定を読み込み、適切なモードで監視を開始する。
   * ユーザーが未設定の場合や、モードが特定できない場合はエラーを出力して終了。
   */
  async start(): Promise<void> {
    console.log('=== AtCoder AC 監視を開始します ===');
    console.log(`監視対象ユーザー: ${this.config.users.join(', ')}`);

    if (this.config.users.length === 0) {
      console.error('エラー: 監視対象ユーザーが設定されていません');
      console.error('config.json に users を追加してください');
      return;
    }

    // RUN_ONCE=true の場合は1回チェックして即終了（GitHub Actions などの CI 用）
    if (process.env.RUN_ONCE === 'true') {
      console.log('=== 1回実行モード（RUN_ONCE）===');
      await this.checkAllUsers();
      console.log('=== チェック完了。終了します ===');
      return;
    }

    // scheduleTimes が設定されていればスケジュールモード、
    // pollingIntervalSeconds が設定されていればポーリングモードで起動
    if (this.config.scheduleTimes && this.config.scheduleTimes.length > 0) {
      await this.startScheduledMode();
    } else if (this.config.pollingIntervalSeconds) {
      await this.startPollingMode();
    } else {
      console.error('エラー: scheduleTimes または pollingIntervalSeconds のいずれかを設定してください');
    }
  }

  // ---------------------------------------------------------------------------
  // 起動モード別の処理
  // ---------------------------------------------------------------------------

  /**
   * スケジュールモード: 指定した時刻（複数可）に cron でジョブを実行する。
   * プロセスは `await new Promise(() => {})` で SIGINT が来るまで生き続ける。
   */
  private async startScheduledMode(): Promise<void> {
    const { scheduleTimes } = this.config;

    console.log('=== スケジュールモードで起動 ===');
    console.log(`実行スケジュール: ${scheduleTimes!.join(', ')}`);
    console.log('');

    this.isRunning = true;
    this.setupSignalHandler();

    // 各スケジュール時刻を cron 式に変換してジョブを登録する
    for (const scheduleTime of scheduleTimes!) {
      const cronExpression = this.convertToCronExpression(scheduleTime);

      cron.schedule(
        cronExpression,
        async () => {
          if (!this.isRunning) return;

          const now = new Date().toLocaleString('ja-JP');
          console.log(`\n[${now}] スケジュール実行開始`);
          try {
            await this.checkAllUsers();
            console.log(`[${new Date().toLocaleString('ja-JP')}] スケジュール実行完了\n`);
          } catch (error) {
            console.error(`[${new Date().toLocaleString('ja-JP')}] スケジュール実行エラー:`, error);
          }
        },
        { timezone: 'Asia/Tokyo' },
      );

      console.log(`✓ ${scheduleTime} にスケジュール設定完了 (cron: ${cronExpression})`);
    }

    console.log('\nスケジューラーが起動しました。終了するには Ctrl+C を押してください。');
    console.log(`現在時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

    // cron タスクが非同期で動き続けるため、Promise を resolve しないことでプロセスを維持する
    await new Promise<never>(() => {});
  }

  /**
   * ポーリングモード: 一定間隔でループしながら全ユーザーをチェックする。
   */
  private async startPollingMode(): Promise<void> {
    console.log('=== ポーリングモードで起動 ===');
    console.log(`ポーリング間隔: ${this.config.pollingIntervalSeconds} 秒`);
    console.log('');

    this.isRunning = true;
    this.setupSignalHandler();

    // isRunning が false になるまでチェックとスリープを繰り返す
    while (this.isRunning) {
      await this.checkAllUsers();
      await this.sleep(this.config.pollingIntervalSeconds! * 1000);
    }
  }

  // ---------------------------------------------------------------------------
  // シグナルハンドリング
  // ---------------------------------------------------------------------------

  /**
   * SIGINT（Ctrl+C）を受け取ったときにフラグを落とし、プロセスを正常終了させる。
   * スケジュールモード・ポーリングモードの両方で共通利用する。
   */
  private setupSignalHandler(): void {
    process.on('SIGINT', () => {
      console.log('');
      console.log('=== 監視を終了します ===');
      this.isRunning = false;
      process.exit(0);
    });
  }

  // ---------------------------------------------------------------------------
  // ユーザーチェックロジック
  // ---------------------------------------------------------------------------

  /**
   * 設定されている全ユーザーを順番にチェックする。
   * エラーが発生したユーザーはログを出してスキップし、retryDelaySeconds 待ってから次ユーザーへ進む。
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
   * 特定ユーザーの新規 AC を検出して通知する。
   *
   * 処理フロー:
   *   1. 前回チェック時刻以降の提出を API で取得
   *   2. 時系列昇順にソート
   *   3. AC のみフィルタリング
   *   4. 既に通知済みでない AC を通知
   *   5. 最終チェック時刻を最新提出の時刻に更新
   */
  private async checkUser(userId: string): Promise<void> {
    const lastChecked = this.stateStore.getLastChecked(userId);

    // lastChecked が 0（初回）の場合は undefined を渡し、API 側のデフォルト（直近24時間）を使う
    const submissions = await this.atcoderClient.fetchSubmissions(
      userId,
      lastChecked > 0 ? lastChecked : undefined,
    );

    if (submissions.length === 0) return;

    // 時系列昇順にソートしてから AC を抽出（通知順序を正確にするため先にソート）
    const sortedSubmissions = this.atcoderClient.sortByTime(submissions);
    const acSubmissions = this.atcoderClient.filterAC(sortedSubmissions);

    for (const submission of acSubmissions) {
      await this.processACSubmission(submission);
    }

    // 全提出の中で最も新しい時刻を次回チェックの起点にする
    const latestSubmission = sortedSubmissions[sortedSubmissions.length - 1];
    this.stateStore.updateLastChecked(userId, latestSubmission.epoch_second);
  }

  /**
   * 1 件の AC 提出を処理する。
   * 既に通知済みの問題（isSolved）はスキップし、初めての AC なら通知してマークする。
   */
  private async processACSubmission(submission: Submission): Promise<void> {
    const { user_id, problem_id, contest_id, language, id, epoch_second, point } = submission;

    // 重複通知防止: 同じユーザー × 問題の組み合わせは一度しか通知しない
    if (this.stateStore.isSolved(user_id, problem_id)) return;

    // 通知前に先にマークすることで、通知失敗時のリトライでも重複を防ぐ
    this.stateStore.markAsSolved(user_id, problem_id);

    const notification: ACNotification = {
      timestamp: new Date(epoch_second * 1000),
      userId: user_id,
      contestId: contest_id,
      problemId: problem_id,
      language,        // ES2015 以降の省略記法（language: language と同義）
      submissionId: id,
      point,           // point: point と同義
    };

    await this.notifier.notify(notification);
  }

  // ---------------------------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------------------------

  /**
   * 時刻文字列を cron 式に変換する。
   *
   * - 既に cron 式（スペース区切り 5 フィールド以上）の場合はそのまま返す
   * - "HH:mm" 形式の場合は "分 時 * * *" 形式に変換する
   *
   * @param timeStr "HH:mm" または cron 式
   * @returns node-cron に渡せる cron 式
   */
  private convertToCronExpression(timeStr: string): string {
    // スペースが含まれており、フィールドが 5 つ以上あれば cron 式とみなす
    if (timeStr.includes(' ') && timeStr.split(' ').length >= 5) {
      return timeStr;
    }

    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      console.warn(`警告: 無効な時刻形式: "${timeStr}"。デフォルトの 09:00 として扱います。`);
      return '0 9 * * *';
    }

    const [, hour, minute] = match;
    // cron 形式: "分 時 日 月 曜日"  ※ parseInt で先頭ゼロを除去
    return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
  }

  /**
   * 指定ミリ秒だけ非同期で待機する。
   * @param ms 待機時間（ミリ秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// エントリーポイント
// =============================================================================

/**
 * プログラムのエントリーポイント。
 * ACMonitor を生成して監視を開始し、予期しないエラーは catch してプロセスを異常終了させる。
 */
async function main(): Promise<void> {
  try {
    const monitor = new ACMonitor();
    await monitor.start();
  } catch (error) {
    console.error('予期しないエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
