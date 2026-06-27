# Resume Bridge 开发指南

## 目录约定

```text
.
├── pages/              # popup/sidebar/options 的 HTML 入口
├── public/             # manifest、图标、本地化等会原样复制到 dist 的静态资源
├── release/            # 打包输出：zip、crx、开发私钥
├── scripts/            # 构建、清理、打包脚本
└── src/
    ├── app/            # React 页面组件
    ├── core/           # 表单识别、匹配、填充、LLM、存储等业务核心
    ├── entries/        # Vite/Rollup 入口：background、content、各页面 main
    └── shared/         # 全局样式、类型等共享资源
```

## 常用命令

```bash
npm install
npm run dev        # watch 构建，Chrome 加载 dist 后刷新扩展即可调试
npm run build      # TypeScript 校验 + 生产构建
npm run package    # 构建并输出 Chromium zip/crx 与 Firefox xpi/zip
npm run package:firefox # 只重新生成 Firefox xpi/zip
npm run clean      # 清理 dist 和已打出的 zip/crx，保留 release/*.pem
```

## Chrome 本地加载

1. 打开 `chrome://extensions/`。
2. 开启开发者模式。
3. 选择 `dist` 作为“加载已解压的扩展程序”的目录。
4. 运行 `npm run dev` 后，代码变更会重新构建，回到扩展页面点刷新即可。

## CRX 打包说明

`npm run package` 会优先复用 `release/resume-bridge.pem`。不要删除这个私钥，否则重新生成的 CRX 会得到新的扩展 ID。

Firefox 包会生成到 `release/resume-bridge-firefox.xpi`，对应的临时加载目录是 `dist-firefox`。Firefox 使用 `sidebar_action`，打包脚本会从 Chromium manifest 自动转换。
