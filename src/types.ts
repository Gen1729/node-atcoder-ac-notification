/**
 * AtCoder Problems API のサブミッション型
 */
export interface Submission {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  user_id: string;
  language: string;
  point: number;
  length: number;
  result: string;
  execution_time: number | null;
}

/**
 * 設定ファイルの型
 */
export interface Config {
  /** 監視対象の AtCoder ユーザー ID のリスト */
  users: string[];
  /** ポーリング間隔（秒） */
  pollingIntervalSeconds: number;
  /** エラー時のリトライ待機時間（秒） */
  retryDelaySeconds: number;
}

/**
 * 永続化する状態の型
 */
export interface State {
  /** ユーザーごとの最終チェック時刻（UNIX秒） */
  lastChecked: Record<string, number>;
  /** AC済み問題の記録 "user_id:problem_id" => true */
  solvedProblems: Record<string, boolean>;
}

/**
 * AC通知のデータ型
 */
export interface ACNotification {
  timestamp: Date;
  userId: string;
  contestId: string;
  problemId: string;
  language: string;
  submissionId: number;
}

/**
 * 通知インターフェース（将来的な拡張のため）
 */
export interface Notifier {
  notify(notification: ACNotification): void | Promise<void>;
}
