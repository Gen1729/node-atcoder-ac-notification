# AtCoder AC 通知ツール

AtCoder の提出を監視し、新しい AC（Accepted）があればターミナルに通知する常駐ツールです。

## 特徴

- 🔍 複数の AtCoder ユーザーを同時監視
- ⏰ 毎日決まった時間にチェック (スケジューリングモード)
- 🔄 定期的なポーリングも可能
- 📝 初回 AC のみを通知（同じ問題の重複通知を防止）
- 💾 状態を永続化し、再起動後も監視を継続
- 🛡️ エラーハンドリング機能付き

## 前提条件

- Node.js 18 以上
- npm または pnpm

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
# または
pnpm install
```

### 2. 設定ファイルの編集

`config.json` を編集して、監視対象のユーザーと実行スケジュールを設定します：

#### スケジューリングモード（推奨）

毎日決まった時間にチェックする場合：

```json
{
  "users": [
    "tourist",
    "jiangly"
  ],
  "scheduleTimes": [
    "09:00",
    "12:00",
    "18:00",
    "21:00"
  ],
  "retryDelaySeconds": 60
}
```

#### ポーリングモード

連続的にチェックする場合：

```json
{
  "users": [
    "tourist",
    "jiangly"
  ],
  "pollingIntervalSeconds": 30,
  "retryDelaySeconds": 60
}
```

**設定項目**:

- `users`: 監視対象の AtCoder ユーザー ID の配列（必須）
- `scheduleTimes`: チェックする時刻の配列（HH:mm 形式）。設定すると毎日その時刻に実行
- `pollingIntervalSeconds`: ポーリング間隔（秒）。scheduleTimes と併用不可
- `retryDelaySeconds`: エラー時のリトライ待機時間（秒）

## 使い方

### 開発モード（自動再起動）

```bash
npm run dev
```

### 通常モード

```bash
npm start
```

### ビルドして実行

```bash
npm run build
npm run run:prod
```

## 出力例

### スケジューリングモード

```
=== AtCoder AC 監視を開始します ===
監視対象ユーザー: tourist, jiangly
=== スケジュールモードで起動 ===
実行スケジュール: 09:00, 12:00, 18:00, 21:00

✓ 09:00 にスケジュール設定完了
✓ 12:00 にスケジュール設定完了
✓ 18:00 にスケジュール設定完了
✓ 21:00 にスケジュール設定完了

スケジューラーが起動しました。終了するには Ctrl+C を押してください。

[2026/2/27 9:00:00] スケジュール実行開始
2026-02-27 09:00:15 tourist AC: ABC300 C (C++)
2026-02-27 09:00:42 jiangly AC: ARC150 B (PyPy3)
[2026/2/27 9:00:45] スケジュール実行完了
```

### ポーリングモード

```
=== AtCoder AC 監視を開始します ===
監視対象ユーザー: tourist, jiangly
=== ポーリングモードで起動 ===
ポーリング間隔: 30 秒

2026-02-26 21:03:15 tourist AC: ABC300 C (C++)
2026-02-26 21:15:42 jiangly AC: ARC150 B (PyPy3)
```

## 停止方法

`Ctrl+C` で停止できます。

## プロジェクト構成

```
node-atcoder-ac-notification/
├── src/
│   ├── index.ts           # エントリーポイント
│   ├── config.ts          # 設定管理
│   ├── atcoderClient.ts   # AtCoder Problems API クライアント
│   ├── stateStore.ts      # 状態の永続化
│   ├── notifier.ts        # 通知処理
│   └── types.ts           # 型定義
├── data/                  # 状態保存用（自動生成）
│   └── state.json
├── config.json            # 設定ファイル
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## 仕組み

### スケジューリングモード

1. **スケジューラー起動**: node-cron を使用して指定時刻にジョブを登録
2. **定時実行**: 設定された時刻（例: 9:00, 12:00, 18:00, 21:00）に自動実行
3. **新規 AC 検出**: 前回チェック以降の提出から AC を抽出
4. **重複排除**: ユーザー + 問題 ID ごとの初回 AC のみ通知
5. **状態保存**: 最終チェック時刻と AC 済み問題を `data/state.json` に保存

### ポーリングモード

1. **ポーリング**: 設定された間隔で AtCoder Problems API に問い合わせ
2. **新規 AC 検出**: 前回チェック以降の提出から AC を抽出
3. **重複排除**: ユーザー + 問題 ID ごとの初回 AC のみ通知
4. **状態保存**: 最終チェック時刻と AC 済み問題を `data/state.json` に保存

## API について

このツールは [AtCoder Problems API](https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md) を使用しています。

- エンドポイント: `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions`
- パラメータ:
  - `user`: ユーザー ID
  - `from_second`: この UNIX 時刻以降の提出のみ取得

## 将来的な拡張

通知機能は抽象化されているため、以下のような拡張が容易です：

- LINE Notify への通知
- Discord Webhook への通知
- Slack への通知
- デスクトップ通知

例：

```typescript
import { Notifier, ACNotification } from './types';

class LineNotifier implements Notifier {
  constructor(private accessToken: string) {}
  
  async notify(notification: ACNotification): Promise<void> {
    // LINE Notify API を使って通知を送信
  }
}
```

## トラブルシューティング

### 起動時に「scheduleTimes または pollingIntervalSeconds のいずれかを設定してください」と表示される

- `config.json` に `scheduleTimes`（スケジューリングモード）または `pollingIntervalSeconds`（ポーリングモード）のいずれかを設定してください

### ユーザーが見つからない

- `config.json` の `users` 配列に正しい AtCoder ユーザー ID が設定されているか確認してください

### API エラーが頻発する

- スケジューリングモードの使用を推奨します（負荷が低い）
- ポーリングモードの場合、`pollingIntervalSeconds` を大きくして、API へのリクエスト頻度を下げてください
- ネットワーク接続を確認してください

### 状態がリセットされる

- `data/state.json` ファイルが破損している可能性があります
- ファイルを削除すると、次回起動時に新規作成されます

## ライセンス

MIT
