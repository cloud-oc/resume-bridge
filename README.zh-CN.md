<p align="center">
  <img src="public/icons/icon128.png" width="96" height="96" alt="Resume Bridge 图标">
</p>

# Resume Bridge

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">中文</a> ·
  <a href="./README.ja.md">日本語</a>
</p>

> 开源网申填写助手。它把个人资料、简历导入、字段匹配和开放题草稿放进一个可复核的浏览器扩展里，帮助求职者少做重复录入，并保留提交前的判断权。

## 名称

`Resume Bridge` 表示它把候选人已经整理好的简历资料，稳稳连接到分散、重复、格式各异的网申表单中。它的重点不是替用户盲目提交，而是帮助组织材料、定位字段、填充内容，并保留提交前的复核权。

GitHub 仓库名与插件包名：`resume-bridge`。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 智能填充 | 打开网申页面，扫描字段后自动匹配并填充可复核内容 |
| 三级匹配引擎 | 规则快速匹配、语义模糊匹配、LLM 兜底 |
| 简历导入 | 上传 PDF / Word / TXT / Markdown 简历，提取结构化资料 |
| 开放题回答 | 基于本地资料生成可编辑的网申问答草稿 |
| ATS 系统适配 | 适配北森、Moka、智联、牛客、前程无忧、Greenhouse 等平台 |
| 本地资料库 | 个人资料、经历素材与 API Key 均存储在浏览器本地 |
| 备份恢复 | JSON 格式导出或导入全部资料 |

## 技术栈

- **框架**: Vite 6 + React 19 + TypeScript 5
- **扩展**: Chromium Manifest V3 / Firefox WebExtensions
- **存储**: IndexedDB
- **AI**: OpenAI / Claude / 通义千问 / 豆包 / Ollama 以及兼容 OpenAI 格式的自定义端点

## 安装使用

### 开发模式

```bash
npm install
npm run dev
```

`npm run dev` 会监听构建到 `dist`。修改代码后，在 `chrome://extensions/` 刷新已加载的扩展即可。

### 生产构建与打包

```bash
npm run build
npm run package
```

打包产物位于：

- `release/resume-bridge.crx`（Chromium）
- `release/resume-bridge.zip`（Chromium 源码包或加载已解压前的 zip）
- `release/resume-bridge-firefox.xpi`（Firefox）
- `release/resume-bridge-firefox.zip`（Firefox 源包）
- `release/resume-bridge.pem`（开发打包私钥；如果需要稳定 Chromium 扩展 ID，请妥善保管）

### 加载到 Chrome / Edge

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist` 目录

### 加载到 Firefox

1. 运行 `npm run package` 生成 Firefox 产物
2. 打开 `about:debugging#/runtime/this-firefox`
3. 点击「Load Temporary Add-on」
4. 选择 `dist-firefox/manifest.json` 或 `release/resume-bridge-firefox.xpi`

## 使用流程

1. 点击插件图标，进入个人资料库。
2. 填写个人信息、教育经历、工作经历和项目经历。
3. 可选：如果需要简历导入、开放题回答或 AI 兜底匹配，先配置 AI 模型。
4. 可选：上传简历并检查提取结果后再保存。
5. 打开企业网申页面。
6. 打开 Resume Bridge 侧边栏并扫描表单。
7. 执行智能填充。
8. 逐项复核必填项、下拉框、开放题、附件上传、隐私授权和分步隐藏字段。
9. 确认无误后手动提交。

## 项目结构

```text
.
├── pages/                       # popup/sidebar/options HTML 入口
├── public/                      # manifest、图标、本地化静态资源
├── scripts/                     # 清理、打包脚本
├── docs/development.md          # 开发迭代说明
└── src/
    ├── app/                     # React 页面：popup/sidebar/options
    ├── core/
    │   ├── engine/              # 匹配、填充、ATS、LLM、简历解析
    │   └── storage/             # IndexedDB 存储、CRUD、备份恢复
    ├── entries/                 # background、content、页面 main 入口
    └── shared/                  # 全局样式、类型、图标、浏览器 API 适配、i18n
```

## 隐私安全

- 所有数据仅存储在本地浏览器 IndexedDB 中。
- API Key 存储在本地。
- AI 请求直接发送到你配置的模型服务。
- Resume Bridge 不会收集、上传或共享你的密钥。
- 填充结果建议在提交前人工复核。

## 致谢

本项目基于 [hanjiayuan2025-coder/CampusApply-Agent](https://github.com/hanjiayuan2025-coder/CampusApply-Agent) 的思路与工程基础继续整理和迭代。感谢原作者对网申自动填充场景的探索。

## 开源协议

MIT License
