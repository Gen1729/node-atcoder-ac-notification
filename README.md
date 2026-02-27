# AtCoder AC 通知ツール

AtCoder の提出を監視し、新しい AC（Accepted）があれば通知する Node.js ツールです。  
**GitHub Actions を使ってサーバーレスで定期実行できます。PC を閉じていても動作します。**

## 特徴

- 🔍 複数の AtCoder ユーザーを同時監視
- ☁️ GitHub Actions による定期実行（PC 不要）
- ⏰ 毎日決まった時間にチェック（スケジュールモード）
- 🔄 一定間隔でループ実行するポーリングモードも対応
- 📝 初回 AC のみを通知（同一問題の重複通知を防止）
- 💾 `data/state.json` に状態を永続化し、再起動後も継続
- 🛡️ エラーハンドリング・自動リトライ機能付き
- 🔌 通知先を差し替え可能な Notifier インターフェース（Discord / LINE / Slack 等）

---

## 動作モード

| モード | 起動方法 | 用途 |
|---|---|---|
| **GitHub Actions**（推奨） | push するだけ | PC 不要・定期実行 |
| **スケジュールモード** | `npm start` | ローカルで指定時刻に実行 |
| **ポーリングモード** | `npm start` | ローカルで一定間隔ループ |
| **1回実行モード** | `RUN_ONCE=true npm start` | CI / スクリプトから呼ぶ |

---

## セットアップ

### 前提条件

- Node.js 18 以上
- GitHub アカウント・リポジトリ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. config.json の編集

`config.json` を編集して、監視対象ユーザーと実行スケジュールを設定します。

#### スケジュールモード（推奨）

```json
{
  "users": ["tourist", "jiangly"],
  "scheduleTimes": ["09:00", "12:00", "18:00", "21:00"],
  "retryDelaySeconds": 60
}
```

#### ポーリングモード

```json
{
  "users": ["tourist", "jiangly"],
  "pollingIntervalSeconds": 3600,
  "retryDelaySeconds": 60
}
```

**設定項目**

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `users` | `string[]` | ✅ | 監視対象の AtCoder ユーザー ID |
| `scheduleTimes` | `string[]` | どちらか1つ | チェック時刻（`"HH:mm"` または cron 式） |
| `pollingIntervalSeconds` | `number` | どちらか1つ | ポーリング間隔（秒） |
| `retryDelaySeconds` | `number` | ✅ | エラー時のリトライ待機時間（秒） |

> `scheduleTimes` と `pollingIntervalSeconds` が両方設定されている場合は `scheduleTimes` が優先されます。

---

## GitHub Actions での実行（推奨）

PC を閉じていても GitHub のサーバーが定期的にチェックを実行します。

### 仕組み

```
GitHub サーバーが cron で起動
  → リポジトリから state.json を取得（前回の状態を引き継ぐ）
  → RUN_ONCE モードで1回チェック実行
  → 更新された state.json を git commit して push
```

### 設定手順

#### Step 1: リポジトリを GitHub に push

```bash
git add .
git commit -m "feat: add GitHub Actions workflow"
git push
```

#### Step 2: Actions の書き込み権限を有効化

```
GitHub リポジトリ → Settings → Actions → General
→ Workflow permissions
→ ✅ "Read and write permissions" を選択して Save
```

これをしないと `state.json` の push が失敗します。

#### Step 3: 動作確認（手動実行）

```
GitHub リポジトリ → Actions タブ
→ "AtCoder AC 定期チェック"
→ "Run workflow" ボタンで即時実行
```

### 実行スケジュール

`.github/workflows/check.yml` の cron は `config.json` の `scheduleTimes` に合わせて設定してください。  
GitHub Actions の cron は **UTC** で指定します（JST − 9 時間）。

| JST | UTC（cron に記載する値） |
|---|---|
| 00:00 | 15:00（前日） |
| 03:00 | 18:00 |
| 06:00 | 21:00 |
| 09:00 | 00:00 |
| 12:00 | 03:00 |
| 15:00 | 06:00 |
| 18:00 | 09:00 |
| 21:00 | 12:00 |

### Actions ログの出力例

Actions タブ → 実行ログ から以下のように確認できます。

```
=== AtCoder AC 監視を開始します ===
監視対象ユーザー: TOMATO10, caz37OwO, toka0428, jet0312
=== 1回実行モード（RUN_ONCE）===
2026-02-27 09:00:12 jet0312 AC:abc390 abc390_c point:300 (C++ 23 (gcc 12.2))
2026-02-27 09:00:14 TOMATO10 AC:abc390 abc390_d point:400 (PyPy3)
=== チェック完了。終了します ===
```

> ⚠️ GitHub Actions はログを表示するだけです。スマホ等へプッシュ通知を受け取りたい場合は、後述の **通知先の拡張** を参照してください。

### 注意事項

- **最大 15 分の遅延**: サーバー負荷により実行が遅れる場合があります。
- **60日ルール**: 60 日間 push がないリポジトリはスケジュールが自動停止します。再開は Actions タブから行えます。

---

## ローカルでの実行

### 開発モード（ファイル変更時に自動再起動）

```bash
npm run dev
```

### 通常起動

```bash
npm start
```

### ビルドして実行

```bash
npm run build
npm run run:prod
```

### 1回実行モード（RUN_ONCE）

```bash
RUN_ONCE=true npm start
```

スケジューラーやループを起動せず、1回チェックして即終了します。

`Ctrl+C` でスケジュール・ポーリングモードを停止できます。

---

## ローカル実行時の出力例

### スケジュールモード

```
=== AtCoder AC 監視を開始します ===
監視対象ユーザー: tourist, jiangly
=== スケジュールモードで起動 ===
実行スケジュール: 09:00, 12:00, 18:00, 21:00

✓ 09:00 にスケジュール設定完了 (cron: 0 9 * * *)
✓ 12:00 にスケジュール設定完了 (cron: 0 12 * * *)
✓ 18:00 にスケジュール設定完了 (cron: 0 18 * * *)
✓ 21:00 にスケジュール設定完了 (cron: 0 21 * * *)

スケジューラーが起動しました。終了するには Ctrl+C を押してください。

[2026/2/27 9:00:00] スケジュール実行開始
2026-02-27 09:00:12 tourist AC:abc390 abc390_c point:300 (C++ 23 (gcc 12.2))
2026-02-27 09:00:14 jiangly AC:arc189 arc189_b point:500 (Haskell)
[2026/2/27 9:00:15] スケジュール実行完了
```

---

## プロジェクト構成

```
node-atcoder-ac-notification/
├── .github/
│   └── workflows/
│       └── check.yml      # GitHub Actions ワークフロー
├── src/
│   ├── index.ts           # エントリーポイント・ACMonitor クラス
│   ├── config.ts          # 設定ファイルの読み込み・バリデーション
│   ├── atcoderClient.ts   # AtCoder Problems API クライアント
│   ├── stateStore.ts      # state.json への状態永続化
│   ├── notifier.ts        # 通知処理（ConsoleNotifier / MultiNotifier）
│   └── types.ts           # 型定義
├── data/
│   └── state.json         # チェック済み状態（Git で管理・自動更新）
├── config.json            # 監視対象・スケジュール設定
├── package.json
├── tsconfig.json
└── README.md
```

---

## 仕組み

### 実行フロー（共通）

1. **設定読み込み**: `config.json` を解析・バリデーション
2. **状態読み込み**: `data/state.json` から前回の `lastChecked`・`solvedProblems` を取得
3. **API リクエスト**: AtCoder Problems API から `lastChecked` 以降の提出を取得
4. **AC 抽出**: 提出を時系列昇順にソートし `result === 'AC'` のみ抽出
5. **重複排除**: `userId:problemId` キーで管理し、初回 AC のみ通知
6. **状態保存**: `data/state.json` に最新の状態を書き込み

### API について

[AtCoder Problems API](https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md) を利用しています。

- エンドポイント: `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions`
- パラメータ: `user`（ユーザー ID）、`from_second`（UNIX 秒、以降の提出を取得）

---

## 通知先の拡張

`Notifier` インターフェースを実装するクラスを追加するだけで、任意の通知先に対応できます。

```typescript
// src/notifier.ts に追加
export class DiscordNotifier implements Notifier {
  constructor(private readonly webhookUrl: string) {}

  async notify(notification: ACNotification): Promise<void> {
    const content =
      `✅ **${notification.userId}** が **${notification.problemId}** を AC！` +
      ` (${notification.contestId} / ${notification.point}点 / ${notification.language})`;

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  }
}
```

`index.ts` の `notifier` を差し替えるだけで Discord に通知できます。  
同様の手順で LINE Notify・Slack Incoming Webhook にも対応可能です。  
複数の通知先に同時送信したい場合は `MultiNotifier` を使ってください。

---

## トラブルシューティング

### `scheduleTimes または pollingIntervalSeconds のいずれかを設定してください`

`config.json` に `scheduleTimes` または `pollingIntervalSeconds` のどちらかを設定してください。

### GitHub Actions が state.json を push できない

Settings → Actions → General → Workflow permissions を **Read and write permissions** に変更してください。

### API エラーが頻発する

- `pollingIntervalSeconds` を大きくして API へのリクエスト頻度を下げてください。
- GitHub Actions のスケジュールモードであれば負荷は最小限です。

### state.json が壊れている

```bash
rm data/state.json
```

次回起動時に自動で新規作成されます（全ユーザーを直近 24 時間分から再チェックします）。

### 60 日間 push がなくスケジュールが停止した

```
GitHub リポジトリ → Actions タブ
→ "AtCoder AC 定期チェック"
→ "Enable workflow" をクリック
```

---

## ライセンス

MIT
