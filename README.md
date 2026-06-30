<p align="center">
  <img src="public/icons/icon128.png" width="96" height="96" alt="Resume Bridge icon">
</p>

# Resume Bridge

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">中文</a> ·
  <a href="./README.ja.md">日本語</a>
</p>

> Open-source online application form assistant. Resume Bridge keeps profile data, resume import, field matching, and open-answer drafting inside a reviewable browser extension so candidates can spend less time on repetitive entry while keeping control before submission.

## Core Features

| Feature | Description |
| --- | --- |
| Smart fill | Scan an online application page, match fields, and fill reviewable content |
| AI-assisted matching | Fast rule matching, fuzzy semantic matching, and optional whole-form AI planning |
| Resume import | Upload PDF / Word / TXT / Markdown resumes and extract structured profile data |
| Open-answer drafting | Generate editable drafts for online application questions from local profile data |
| ATS platform profiles | Includes adapters for Beisen, Moka, Zhaopin, Nowcoder, 51job, Greenhouse, and more |
| Local profile library | Personal info, experience material, and API keys stay in local browser storage |
| Backup and restore | Export or import the full profile library as JSON |

## Tech Stack

- **Framework**: Vite 6 + React 19 + TypeScript 5
- **Extension runtime**: Chromium Manifest V3 / Firefox WebExtensions
- **Storage**: IndexedDB
- **AI providers**: OpenAI / Claude / Qwen / Doubao / Ollama and compatible custom endpoints

## Installation

### Development Mode

```bash
npm install
npm run dev
```

`npm run dev` watches and rebuilds into `dist`. After code changes, refresh the loaded extension in `chrome://extensions/`.

### Production Build and Packaging

```bash
npm run build
npm run package
```

Generated packages:

- `release/resume-bridge.crx` for Chromium
- `release/resume-bridge.zip` for Chromium source distribution or unpacked loading
- `release/resume-bridge-firefox.xpi` for Firefox
- `release/resume-bridge-firefox.zip` for Firefox source distribution
- `release/resume-bridge.pem` development packaging key. Keep it private if you need a stable Chromium extension ID.

### Load in Chrome / Edge

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the `dist` directory.

### Load in Firefox

1. Run `npm run package`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose Load Temporary Add-on.
4. Select `dist-firefox/manifest.json` or `release/resume-bridge-firefox.xpi`.

## Usage

1. Open the extension popup and go to the profile library.
2. Fill in personal info, education, work experience, and project experience.
3. Optional: configure an AI model if you need resume import, open-answer drafting, or stronger whole-form matching.
4. Optional: import a resume and review extracted fields before saving.
5. Open an online application page.
6. Open the Resume Bridge side panel and scan the form.
7. Run smart fill.
8. Review required fields, dropdowns, open answers, file uploads, consent boxes, and hidden step fields.
9. Submit manually only after everything looks correct.

## Project Structure

```text
.
├── pages/                       # popup/sidebar/options HTML entries
├── public/                      # manifest, icons, and extension locale resources
├── scripts/                     # cleanup and packaging scripts
├── docs/development.md          # development notes
└── src/
    ├── app/                     # React pages: popup/sidebar/options
    ├── core/
    │   ├── engine/              # matching, filling, ATS, LLM, resume parsing
    │   └── storage/             # IndexedDB storage, CRUD, backup/restore
    ├── entries/                 # background, content, and page entry points
    └── shared/                  # global styles, types, icons, browser API shims, i18n
```

## Privacy and Safety

- Data is stored in local browser IndexedDB.
- API keys are stored locally.
- AI requests are sent directly to the configured model service.
- Resume Bridge does not collect, upload, or share your keys.
- Filled results should always be manually reviewed before submission.

## Credits

This project continues from the ideas and engineering foundation of [hanjiayuan2025-coder/CampusApply-Agent](https://github.com/hanjiayuan2025-coder/CampusApply-Agent). Thanks to the original author for exploring the online application auto-fill scenario.

## License

MIT License
