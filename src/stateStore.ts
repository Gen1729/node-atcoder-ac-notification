import * as fs from 'fs';
import * as path from 'path';
import { State } from './types';

const DEFAULT_STATE: State = {
  lastChecked: {},
  solvedProblems: {},
};

export class StateStore {
  private state: State;
  private readonly statePath: string;

  constructor(dataDir: string = 'data', stateFile: string = 'state.json') {
    const fullDataDir = path.resolve(process.cwd(), dataDir);
    this.statePath = path.join(fullDataDir, stateFile);

    // データディレクトリが存在しなければ作成
    if (!fs.existsSync(fullDataDir)) {
      fs.mkdirSync(fullDataDir, { recursive: true });
    }

    this.state = this.load();
  }

  /**
   * 状態ファイルを読み込む
   */
  private load(): State {
    try {
      if (!fs.existsSync(this.statePath)) {
        console.log(`状態ファイルが存在しないため、新規作成します: ${this.statePath}`);
        return { ...DEFAULT_STATE };
      }

      const content = fs.readFileSync(this.statePath, 'utf-8');
      const state = JSON.parse(content) as State;

      // バリデーション
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
   * 状態ファイルを保存する
   */
  private save(): void {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (error) {
      console.error(`状態ファイルの保存に失敗しました: ${error}`);
    }
  }

  /**
   * ユーザーの最終チェック時刻を取得
   */
  getLastChecked(userId: string): number {
    return this.state.lastChecked[userId] || 0;
  }

  /**
   * ユーザーの最終チェック時刻を更新
   */
  updateLastChecked(userId: string, epochSecond: number): void {
    this.state.lastChecked[userId] = epochSecond;
    this.save();
  }

  /**
   * 問題が既に AC 済みかどうかを確認
   */
  isSolved(userId: string, problemId: string): boolean {
    const key = `${userId}:${problemId}`;
    return this.state.solvedProblems[key] === true;
  }

  /**
   * 問題を AC 済みとしてマーク
   */
  markAsSolved(userId: string, problemId: string): void {
    const key = `${userId}:${problemId}`;
    this.state.solvedProblems[key] = true;
    this.save();
  }

  /**
   * 現在の状態を取得（デバッグ用）
   */
  getState(): State {
    return { ...this.state };
  }
}
