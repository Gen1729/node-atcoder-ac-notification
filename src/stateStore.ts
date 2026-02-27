import * as fs from 'fs';
import * as path from 'path';
import { State } from './types';

/** 初期状態のテンプレート（ファイルが存在しない場合やパースエラー時に使用） */
const DEFAULT_STATE: State = {
  lastChecked: {},
  solvedProblems: {},
};

/**
 * 監視状態を JSON ファイルに永続化するクラス。
 *
 * 保持する情報:
 *   - lastChecked    : ユーザーごとの最終チェック時刻（UNIX 秒）
 *   - solvedProblems : 既に AC 通知済みの「ユーザー:問題 ID」セット
 *
 * 状態の変更（updateLastChecked / markAsSolved）は毎回ファイルへ書き出す。
 * 書き出し頻度が問題になる場合はバッファリングへの変更を検討すること。
 */
export class StateStore {
  /** メモリ上の状態キャッシュ */
  private state: State;
  /** 永続化先のファイルパス（絶対パス） */
  private readonly statePath: string;

  /**
   * @param dataDir   状態ファイルを格納するディレクトリ（process.cwd() からの相対パス）
   * @param stateFile 状態ファイル名
   */
  constructor(dataDir: string = 'data', stateFile: string = 'state.json') {
    const fullDataDir = path.resolve(process.cwd(), dataDir);
    this.statePath = path.join(fullDataDir, stateFile);

    // データディレクトリが存在しなければ再帰的に作成する
    if (!fs.existsSync(fullDataDir)) {
      fs.mkdirSync(fullDataDir, { recursive: true });
    }

    this.state = this.load();
  }

  // ---------------------------------------------------------------------------
  // 内部メソッド
  // ---------------------------------------------------------------------------

  /**
   * 状態ファイルを読み込んでメモリに展開する。
   * ファイルが存在しない場合やパースエラーの場合は DEFAULT_STATE を返す。
   */
  private load(): State {
    try {
      if (!fs.existsSync(this.statePath)) {
        console.log(`状態ファイルが存在しないため、新規作成します: ${this.statePath}`);
        return { ...DEFAULT_STATE };
      }

      const content = fs.readFileSync(this.statePath, 'utf-8');
      const state = JSON.parse(content) as State;

      // 破損したファイルでも各フィールドが欠けていた場合にデフォルト値で補完する
      if (!state.lastChecked || typeof state.lastChecked !== 'object') {
        state.lastChecked = {};
      }
      if (!state.solvedProblems || typeof state.solvedProblems !== 'object') {
        state.solvedProblems = {};
      }

      return state;
    } catch (error) {
      console.error(`状態ファイルの読み込みに失敗しました: ${error}`);
      console.error('デフォルト状態を使用します');
      return { ...DEFAULT_STATE };
    }
  }

  /**
   * 現在のメモリ上の状態をファイルへ書き出す。
   * 書き込みエラーはログのみ出力し、例外はスローしない（監視処理を止めないため）。
   */
  private save(): void {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (error) {
      console.error(`状態ファイルの保存に失敗しました: ${error}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 公開 API
  // ---------------------------------------------------------------------------

  /**
   * 指定ユーザーの最終チェック時刻（UNIX 秒）を返す。
   * 未記録の場合は 0 を返す（呼び出し側で「初回チェック」と判定できる）。
   */
  getLastChecked(userId: string): number {
    return this.state.lastChecked[userId] ?? 0;
  }

  /**
   * 指定ユーザーの最終チェック時刻を更新してファイルへ保存する。
   * @param epochSecond 最終チェック時刻（UNIX 秒）
   */
  updateLastChecked(userId: string, epochSecond: number): void {
    this.state.lastChecked[userId] = epochSecond;
    this.save();
  }

  /**
   * 指定ユーザーが指定問題を既に AC 通知済みかどうかを返す。
   * 内部キーは "userId:problemId" 形式。
   */
  isSolved(userId: string, problemId: string): boolean {
    const key = `${userId}:${problemId}`;
    return this.state.solvedProblems[key] === true;
  }

  /**
   * 指定ユーザーの指定問題を AC 通知済みとしてマークしてファイルへ保存する。
   * 一度マークした問題は isSolved() が true を返し続けるため、二重通知を防げる。
   */
  markAsSolved(userId: string, problemId: string): void {
    const key = `${userId}:${problemId}`;
    this.state.solvedProblems[key] = true;
    this.save();
  }

  /**
   * 現在のメモリ上の状態のシャローコピーを返す（主にデバッグ・テスト用）。
   * 内部オブジェクト（lastChecked, solvedProblems）は参照共有されるため、
   * 外部から直接変更しないこと。
   */
  getState(): State {
    return { ...this.state };
  }
}
