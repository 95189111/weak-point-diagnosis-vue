# 面向学情分析的学生薄弱知识点识别系统（Vue3 重构版 V2.0）

原 Django 后端 + 静态页面的单体系统，重构为 **Vue3 单页应用**：后端业务逻辑与种子数据以
Mock 方式内嵌在前端服务中（`src/mock`），无需任何服务器即可运行，可直接部署到
Cloudflare Pages 等静态托管平台。

业务闭环保持与原系统一致：**测（学情导入）→ 诊（薄弱识别）→ 练（靶向练习）→ 跟（干预跟踪）**。

## 技术栈

- Vue 3.5（Composition API + `<script setup>`）
- Vite 5、Vue Router 4（Hash 模式）、Pinia 2
- Element Plus 2.8、ECharts 5（按需注册）

## 目录结构

```
src/
├── ai/engine.js          # AI 能力引擎（Mock 生成器，基于本地数据合成）
├── api/
│   ├── index.js          # API 客户端（HTTP 语义 → Mock 路由分发，模拟时延）
│   └── ai.js             # AI 流式客户端（打字机回放，支持中断）
├── mock/                 # 内置"后端"
│   ├── seed.js           # 种子数据（与原系统 seed_dump.json 同源）
│   ├── db.js             # localStorage 持久化的内存数据库
│   ├── auth.js           # HMAC 风格 Token（TTL 8h）
│   ├── index.js          # METHOD + URL 模式路由表
│   └── handlers/         # accounts/knowledge/exams/diagnosis/practice/analytics/ai
├── components/           # StatCard / LevelTag / ChartBase / AiMarkdown / AiStreamDialog / AiAssistant
├── layouts/MainLayout.vue
├── stores/auth.js
└── views/                # 10 个业务页面
```

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物输出到 dist/
npm run preview    # 本地预览构建产物
```

演示账号（登录页可一键填入）：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 教师 | teacher01 | Teach@2026 |
| 教研组长 | leader01 | Leader@2026 |
| 学生 | student01 | Stu@2026 |
| 管理员 | admin | Admin@2026 |

## AI 功能（全部 Mock 实现，业务数据真实）

| 功能 | 入口 | 接口 |
| --- | --- | --- |
| AI 今日教学简报 | 工作台 | POST `/api/ai/briefing` |
| AI 诊断归因解读 | 薄弱诊断 · 详情抽屉 | POST `/api/ai/explain-diagnosis` |
| AI 学情评语 | 学生画像 · 画像抽屉 | POST `/api/ai/student-comment` |
| AI 智能组卷 | 靶向练习 · 创建练习 · AI 组卷页签 | POST `/api/ai/generate-quiz` |
| AI 班级讲评报告 | 班级对比 | POST `/api/ai/report-comment` |
| AI 教学助手对话 | 全局右下角悬浮球 | POST `/api/ai/chat` |

输出以 Markdown 流式渲染（打字机效果，可停止/重新生成/复制）。

## 核心业务规则（与原后端一致）

- 掌握度 = 班级得分率×0.62 + 知识点基准×0.38 − 趋势罚分（连续下滑 3 分），夹取 [15, 98]
- 三档判定：`< 薄弱阈值(60)` 薄弱 / `< 临界阈值(70)` 临界 / 否则达标（达标拒绝生成诊断）
- 状态机：诊断 待复核→已确认→已推送→已销号；干预 待开始→进行中→已复查→已销号（联动关闭诊断单）
- 幂等：同知识点+班级已有待复核/已确认诊断时刷新原单
- 练习结束未填二次正确率时按 `48 + 完成率×0.35` 估算
- 阈值校验：薄弱 30-80、临界 40-90 且大于薄弱阈值、复查周期 3-30 天

## 部署到 Cloudflare Pages

方式一（控制台）：把 `dist/` 文件夹拖拽上传到 Cloudflare Pages 即可。

方式二（连接 Git 仓库，构建配置）：

- Build command: `npm run build`
- Build output directory: `dist`

方式三（命令行）：

```bash
npx wrangler pages deploy dist
```

说明：路由使用 Hash 模式，`public/_redirects` 已配置 SPA 回退；
`vite.config.js` 的 `base: './'` 保证任意子路径托管可用。

## 备注

- 数据保存在浏览器 localStorage（键 `APP_DB_V2`），清空后自动恢复种子数据；
  系统设置页可重置阈值，所有改动仅影响本机演示数据。
- 本仓库附带 `.tools/node-v20.18.1-win-x64`（便携版 Node，来自项目根目录的临时工具），
  若本机已安装 Node.js 可直接删除该目录。
