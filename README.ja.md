<p align="center">
  <img src="public/icons/icon128.png" width="96" height="96" alt="Resume Bridge icon">
</p>

# Resume Bridge

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">中文</a> ·
  <a href="./README.ja.md">日本語</a>
</p>

> オープンソースのオンライン応募フォーム入力アシスタントです。プロフィール、履歴書インポート、項目マッチング、自由回答ドラフトを、確認しやすいブラウザー拡張にまとめます。

## 主な機能

| 機能 | 説明 |
| --- | --- |
| スマート入力 | 応募ページをスキャンし、対応する項目へ確認可能な内容を入力 |
| AI 支援マッチング | ルールマッチング、意味的な曖昧マッチング、任意の全フォーム AI プランニング |
| 履歴書インポート | PDF / Word / TXT / Markdown から構造化プロフィールを抽出 |
| 自由回答ドラフト | ローカル資料から編集可能な応募回答案を生成 |
| ATS プロファイル | Beisen、Moka、Zhaopin、Nowcoder、51job、Greenhouse などに対応 |
| ローカルプロフィール | 個人情報、経験素材、API Key をブラウザー内に保存 |
| バックアップと復元 | JSON 形式でプロフィールライブラリをエクスポート / インポート |

## 技術スタック

- **フレームワーク**: Vite 6 + React 19 + TypeScript 5
- **拡張機能**: Chromium Manifest V3 / Firefox WebExtensions
- **ストレージ**: IndexedDB
- **AI**: OpenAI / Claude / Qwen / Doubao / Ollama、および OpenAI 互換のカスタムエンドポイント

## インストール

### 開発モード

```bash
npm install
npm run dev
```

`npm run dev` は `dist` へ監視ビルドします。変更後は `chrome://extensions/` で読み込み済み拡張機能を更新してください。

### 本番ビルドとパッケージ

```bash
npm run build
npm run package
```

生成されるファイル：

- `release/resume-bridge.crx`（Chromium）
- `release/resume-bridge.zip`（Chromium ソース配布または展開前 zip）
- `release/resume-bridge-firefox.xpi`（Firefox）
- `release/resume-bridge-firefox.zip`（Firefox ソース配布）
- `release/resume-bridge.pem`（開発用パッケージキー。Chromium 拡張 ID を安定させる場合は非公開で保管してください）

### Chrome / Edge に読み込む

1. `chrome://extensions/` を開きます。
2. Developer mode を有効にします。
3. Load unpacked を選びます。
4. `dist` ディレクトリを選択します。

### Firefox に読み込む

1. `npm run package` を実行します。
2. `about:debugging#/runtime/this-firefox` を開きます。
3. Load Temporary Add-on を選びます。
4. `dist-firefox/manifest.json` または `release/resume-bridge-firefox.xpi` を選択します。

## 使い方

1. 拡張機能のポップアップからプロフィールライブラリを開きます。
2. 個人情報、学歴、職務経験、プロジェクト経験を入力します。
3. 任意：履歴書インポート、自由回答、より強い全フォーム AI マッチングが必要な場合は AI モデルを設定します。
4. 任意：履歴書をアップロードし、抽出結果を確認してから保存します。
5. 企業のオンライン応募ページを開きます。
6. Resume Bridge のサイドパネルを開き、フォームをスキャンします。
7. スマート入力を実行します。
8. 必須項目、プルダウン、自由回答、添付、同意チェック、隠れたステップ項目を確認します。
9. 問題がなければ手動で送信します。

## プロジェクト構成

```text
.
├── pages/                       # popup/sidebar/options HTML エントリ
├── public/                      # manifest、アイコン、ローカライズリソース
├── scripts/                     # クリーンアップとパッケージスクリプト
├── docs/development.md          # 開発メモ
└── src/
    ├── app/                     # React ページ：popup/sidebar/options
    ├── core/
    │   ├── engine/              # マッチング、入力、ATS、LLM、履歴書解析
    │   └── storage/             # IndexedDB、CRUD、バックアップ / 復元
    ├── entries/                 # background、content、各ページエントリ
    └── shared/                  # 共通スタイル、型、アイコン、ブラウザー API shim、i18n
```

## プライバシーと安全性

- すべてのデータはブラウザーの IndexedDB に保存されます。
- API Key はローカルに保存されます。
- AI リクエストは設定したモデルサービスへ直接送信されます。
- Resume Bridge はキーを収集、アップロード、共有しません。
- 入力結果は送信前に必ず確認してください。

## クレジット

このプロジェクトは [hanjiayuan2025-coder/CampusApply-Agent](https://github.com/hanjiayuan2025-coder/CampusApply-Agent) のアイデアとエンジニアリング基盤をもとに整理・発展させたものです。オンライン応募フォーム自動入力の探索に感謝します。

## ライセンス

MIT License
