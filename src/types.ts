/**
 * AtCoder Problems API（kenkoooo.com）が返すサブミッション 1 件分の型。
 * API ドキュメント: https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md
 */
export interface Submission {
  /** サブミッション ID（AtCoder 上の一意 ID） */
  id: number;
  /** 提出時刻（UNIX 秒） */
  epoch_second: number;
  /** 問題 ID（例: "abc300_a"） */
  problem_id: string;
  /** コンテスト ID（例: "abc300"） */
  contest_id: string;
  /** ユーザー ID */
  user_id: string;
  /** 使用言語（例: "C++ 23 (gcc 12.2)"） */
  language: string;
  /** 問題の配点 */
  point: number;
  /** ソースコードの長さ（バイト） */
  length: number;
  /** ジャッジ結果（"AC", "WA", "TLE" など） */
  result: string;
  /** 実行時間（ミリ秒）。コンパイルエラーなどで計測不能な場合は null */
  execution_time: number | null;
}

/**
 * config.json の構造を表す型。
 *
 * 動作モードは以下の 2 択（両方書いた場合は scheduleTimes が優先される）:
 *   - scheduleTimes       : 指定した時刻に定期実行（スケジュールモード）
 *   - pollingIntervalSeconds: 一定間隔でループ実行（ポーリングモード）
 */
export interface Config {
  /** 監視対象の AtCoder ユーザー ID のリスト */
  users: string[];
  /**
   * ポーリング間隔（秒）。scheduleTimes が設定されていない場合に使用される。
   * 省略した場合はポーリングモードで起動できない。
   */
  pollingIntervalSeconds?: number;
  /** エラー発生時に次のリトライまで待機する時間（秒） */
  retryDelaySeconds: number;
  /**
   * スケジュール実行時刻のリスト。
   * 各要素は "HH:mm" 形式（例: "09:00"）または cron 式（例: "0 9 * * *"）。
   * 設定されている場合、pollingIntervalSeconds より優先される。
   */
  scheduleTimes?: string[];
}

/**
 * StateStore が JSON ファイルへ永続化するアプリケーション状態の型。
 */
export interface State {
  /** ユーザーごとの最終チェック時刻（UNIX 秒）。キーはユーザー ID。 */
  lastChecked: Record<string, number>;
  /**
   * AC 通知済み問題のセット。
   * キーは "userId:problemId" 形式（例: "tourist:abc300_a"）、値は常に true。
   */
  solvedProblems: Record<string, boolean>;
}

/**
 * 通知イベント 1 件分のデータを表す型。
 * processACSubmission で生成され Notifier.notify() に渡される。
 */
export interface ACNotification {
  /** 提出時刻 */
  timestamp: Date;
  /** AtCoder ユーザー ID */
  userId: string;
  /** コンテスト ID（例: "abc300"） */
  contestId: string;
  /** 問題 ID（例: "abc300_a"） */
  problemId: string;
  /** 使用言語 */
  language: string;
  /** サブミッション ID */
  submissionId: number;
  /** 問題の配点 */
  point: number;
}

/**
 * 通知処理を抽象化するインターフェース。
 * ConsoleNotifier・MultiNotifier などの具体的な実装が implements する。
 * 将来的に LINE・Slack・Discord などへの通知クラスを追加する際もこのインターフェースに準拠させる。
 */
export interface Notifier {
  notify(notification: ACNotification): void | Promise<void>;
}
