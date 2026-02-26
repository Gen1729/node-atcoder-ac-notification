import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';

const DEFAULT_CONFIG: Config = {
  users: [],
  pollingIntervalSeconds: 30,
  retryDelaySeconds: 60,
};

/**
 * 設定ファイルを読み込む
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

    // バリデーション
    if (!Array.isArray(config.users)) {
      throw new Error('config.users は配列である必要があります');
    }

    if (typeof config.pollingIntervalSeconds !== 'number' || config.pollingIntervalSeconds <= 0) {
      throw new Error('config.pollingIntervalSeconds は正の数値である必要があります');
    }

    if (typeof config.retryDelaySeconds !== 'number' || config.retryDelaySeconds <= 0) {
      throw new Error('config.retryDelaySeconds は正の数値である必要があります');
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`設定ファイルの読み込みに失敗しました: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 設定ファイルに記述例を作成する
 */
export function createSampleConfig(configPath: string = 'config.json'): void {
  const fullPath = path.resolve(process.cwd(), configPath);

  if (fs.existsSync(fullPath)) {
    console.warn(`設定ファイルは既に存在します: ${fullPath}`);
    return;
  }

  const sampleConfig: Config = {
    users: ['tourist', 'jiangly'],
    pollingIntervalSeconds: 30,
    retryDelaySeconds: 60,
  };

  fs.writeFileSync(fullPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
  console.log(`サンプル設定ファイルを作成しました: ${fullPath}`);
}
