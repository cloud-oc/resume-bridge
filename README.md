<p align="center">
  <img src="public/icons/icon128.png" width="96" height="96" alt="Resume Bridge icon">
</p>

# Resume Bridge

<p align="center">
  <a href="#resume-bridge">English</a> ·
  <a href="#中文">中文</a> ·
  <a href="#日本語">日本語</a>
</p>

Resume Bridge is an open-source browser extension for online application forms. It helps candidates keep a local profile library, parse resumes, scan application pages, fill matched fields, draft open-answer responses, and review every result before submitting.

Project: [github.com/cloud-oc/resume-bridge](https://github.com/cloud-oc/resume-bridge)

Copyright: ©Cloud09

## Why It Exists

Online application systems are fragmented, repetitive, and often tedious. Resume Bridge turns your resume and reusable career material into a local, structured profile that can be bridged into many different application forms. It is designed for internships, campus hiring, and experienced-hire applications.

The extension does not submit applications for you. It keeps automation visible and reviewable so the final decision stays with the user.

## Highlights

| Capability | What it does |
| --- | --- |
| Smart fill panel | Scan fields on the current application page and fill matched content |
| Three-stage matching | Rule matching, fuzzy semantic matching, and optional AI fallback |
| Resume import | Extract structured profile data from PDF, Word, TXT, and Markdown resumes |
| Open-answer drafting | Generate editable drafts for application questions from local profile data |
| ATS awareness | Includes profiles for common application platforms such as Beisen, Moka, Zhaopin, Nowcoder, 51job, and Greenhouse |
| Local profile library | Stores personal info, education, experience, and AI settings in the browser |
| Backup and restore | Export or import the full local profile library as JSON |
| Multilingual UI | Switch the extension shell and help content between English, Chinese, and Japanese |

## Install From Source

```bash
npm install
npm run build
```

Load the generated `dist` directory in Chrome or Edge:

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the `dist` directory.

## Firefox

Firefox-compatible packaging is included:

```bash
npm run package
```

Generated packages:

- `release/resume-bridge.zip` for Chromium source distribution
- `release/resume-bridge.crx` for Chromium installation when Chrome packaging is available
- `release/resume-bridge-firefox.zip` for Firefox source distribution
- `release/resume-bridge-firefox.xpi` for Firefox temporary installation and signing workflows

To load temporarily in Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose Load Temporary Add-on.
3. Select `dist-firefox/manifest.json` or `release/resume-bridge-firefox.xpi`.

## Development

```bash
npm run dev
```

`npm run dev` watches and rebuilds into `dist`. Refresh the loaded extension after each rebuild.

Useful commands:

```bash
npm run build
npm run package
npm run package:firefox
```

## Usage

1. Open the extension options page and fill in your profile library.
2. Add education, work, project, or research experience that you reuse across applications.
3. Optional: configure an AI model if you want resume import, open-answer drafting, or AI fallback matching.
4. Optional: import a resume and review the extracted result before saving.
5. Open an online application page.
6. Open the Resume Bridge side panel, scan the form, run smart fill, and review every field.
7. Submit manually only after checking required fields, dropdowns, attachments, consent boxes, and open answers.

## Privacy

- Profile data is stored in local browser storage.
- API keys are stored locally.
- AI requests go directly to the model provider you configure.
- Resume Bridge does not collect, upload, or share your keys.
- Filled results should always be reviewed before submission.

## Project Layout

```text
.
├── pages/                 # popup, sidebar, and options HTML entries
├── public/                # manifest, icons, and extension locale files
├── scripts/               # cleanup and packaging scripts
├── docs/                  # development notes
└── src/
    ├── app/               # React UI surfaces
    ├── core/              # matching, filling, ATS, LLM, resume parsing, storage
    ├── entries/           # background, content, popup, sidebar, options entries
    └── shared/            # styles, icons, browser API shims, i18n, types
```

## Credits

Resume Bridge continues from the ideas and engineering foundation of [hanjiayuan2025-coder/CampusApply-Agent](https://github.com/hanjiayuan2025-coder/CampusApply-Agent). Thanks to the original author for exploring automated online application assistance.

## License

MIT License

## 中文

Resume Bridge 是一个开源网申填写助手。它把个人资料、简历解析、字段匹配、开放题草稿和提交前复核放进一个浏览器扩展里，适用于实习、校招和社招等线上申请场景。

项目地址：[github.com/cloud-oc/resume-bridge](https://github.com/cloud-oc/resume-bridge)

版权：©Cloud09

### 核心能力

- 本地资料库：维护个人信息、教育经历、工作/项目经历和 AI 配置。
- 智能填充：扫描当前网申页面字段，匹配并写入可复核的内容。
- 简历导入：支持 PDF、Word、TXT、Markdown 简历解析。
- 开放题草稿：基于本地资料生成可编辑回答。
- 多语言界面：支持英文、中文、日文切换，默认英文。
- 隐私优先：资料和 API Key 保存在本地浏览器；AI 请求直接发往你配置的模型服务。

### 构建和打包

```bash
npm install
npm run build
npm run package
```

打包产物位于 `release/`，包含 Chromium 的 `.zip` / `.crx` 和 Firefox 的 `.zip` / `.xpi`。

### 使用流程

1. 打开设置页，先补齐个人资料库。
2. 按需配置 AI 模型或导入简历。
3. 打开企业网申页面，打开侧边栏。
4. 先扫描表单，再执行智能填充。
5. 逐项复核字段、下拉框、开放题、附件和授权项。
6. 确认无误后手动提交。

## 日本語

Resume Bridge は、オンライン応募フォーム向けのオープンソース拡張機能です。プロフィール管理、履歴書インポート、フォームスキャン、自動入力、自由回答ドラフト、送信前レビューをひとつにまとめます。インターン、新卒採用、中途採用などの応募に利用できます。

プロジェクト：[github.com/cloud-oc/resume-bridge](https://github.com/cloud-oc/resume-bridge)

著作権：©Cloud09

### 主な機能

- ローカルプロフィール：個人情報、学歴、職務・プロジェクト経験、AI 設定を保存。
- スマート入力：応募ページをスキャンし、対応する項目を入力。
- 履歴書インポート：PDF、Word、TXT、Markdown に対応。
- 自由回答ドラフト：ローカル資料から編集可能な回答案を生成。
- 多言語 UI：英語、中国語、日本語を切り替え可能。既定は英語。
- プライバシー重視：プロフィールと API Key はブラウザー内に保存。AI リクエストは設定した提供元へ直接送信。

### ビルドとパッケージ

```bash
npm install
npm run build
npm run package
```

`release/` に Chromium 用 `.zip` / `.crx` と Firefox 用 `.zip` / `.xpi` が生成されます。

### 使い方

1. 設定ページでプロフィールライブラリを作成します。
2. 必要に応じて AI モデルを設定するか、履歴書をインポートします。
3. 企業の応募ページを開き、サイドパネルを開きます。
4. フォームをスキャンしてからスマート入力を実行します。
5. 項目、プルダウン、自由回答、添付、同意チェックを確認します。
6. 問題がなければ手動で送信します。
