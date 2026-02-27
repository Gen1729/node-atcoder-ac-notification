import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';

/**
 * loadConfig でファイルが見つからなかった場合に使うフォールバック設定。
 * users が空なので start() 内のバリデーションで必ず警告が出る。
 */
const DEFAULT_CONFIG: Config = {
  users: [],
  retryDelaySeconds: 60,
};

/**
 * JSON 設定ファイルを読み込み、バリデーションを行って Config オブジェクトを返す。
 *
 * @param configPath 設定ファイルのパス（process.cwd() からの相対パスまたは絶対パス）
 * @throws {Error}  JSON のパースエラー、または必須フィールドの型・値が不正な場合
 */
export function loadConfig(configPath: string = 'config.json'): Config {
  const fullPath = path.resolve(process.cwd(), configPath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.warn(`設定ファイルが見つかりません: ${fullPath}`);
      console.warn('デフォルト設定を使用します');
      return DEFAULT_CONFIG;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const config = JSON.parse(content) as Config;

    // --- バリデーション --------------------------------------------------------

    if (!Array.isArray(config.users)) {
      throw new Error('config.users は配列である必要があります');
    }

    if (
      config.pollingIntervalSeconds !== undefined &&
      (typeof config.pollingIntervalSeconds !== 'number' || config.pollingIntervalSeconds <= 0)
    ) {
      throw new Error('config.pollingIntervalSeconds は正の数値である必要があります');
    }

    if (typeof config.retryDelaySeconds !== 'number' || config.retryDelaySeconds <= 0) {
      throw new Error('config.retryDelaySeconds は正の数値である必要があります');
    }

    if (config.scheduleTimes !== undefined) {
      if (!Array.isArray(config.scheduleTimes)) {
        throw new Error('config.scheduleTimes は配列である必要があります');
      }
      if (config.scheduleTimes.length === 0) {
        throw new Error('config.scheduleTimes は少なくとも1つの時刻を含む必要があります');
      }
    }

    return config;
  } catch (error) {
    // エラーメッセージをラップして呼び出し元がファイルパスを特定できるようにする
    if (error instanceof Error) {
      throw new Error(`設定ファイルの読み込みに失敗しました: ${error.message}`);
    }
    throw error;
  }
}

/**
 * サンプルの設定ファイルを生成するユーティリティ関数。
 * 初回セットアップ時にコマンドラインから呼び出すことを想定している。
 * 既にファイルが存在する場合は上書きせずに警告を出して終了する。
 *
 * @param configPath 出力先のパス（デフォルト: "config.json"）
 */
export function createSampleConfig(configPath: string = 'config.json'): void {
  const fullPath = path.resolve(process.cwd(), configPath);

  if (fs.existsSync(fullPath)) {
    console.warn(`設定ファイルは既に存在します: ${fullPath}`);
    return;
  }

  // スケジュールモードのサンプル（毎日 9:00 と 21:00 に実行）
  const sampleConfig: Config = {
    users: ['tourist', 'jiangly'],
    retryDelaySeconds: 60,
    scheduleTimes: ['09:00', '21:00'],
  };

  fs.writeFileSync(fullPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
  console.log(`サンプル設定ファイルを作成しました: ${fullPath}`);
}
