# 析微-学生薄弱知识点识别系统

"析微"把班级每一次测验的得分数据结构化入库，用掌握度模型把"哪个班、哪个知识点、弱到什么程度"算清楚，再按 测 → 诊 → 练 → 跟 的教学闭环，自动产出诊断单、靶向练习与干预跟踪，让教师从"凭经验感觉谁没学会"升级为"用数据看清谁没学会、为什么没学会、补没补上来"。

## 团队信息
### 参赛团队

- 团队名称：**K2**
- 所属院校：**西安汽车职业大学 · 人工智能学院**

### 学生成员（3 名）

| 序号 | 姓名 | 学号 | 分工 | 主要负责 |
| --- | --- | --- | --- | --- |
| 1 | 苏政涵 | 2442201002 | 产品与前端架构 | 业务闭环设计、页面组件拆分、10 个业务视图实现 |
| 2 | 袁香莹 | 2440401029 | AI 与数据可视化 | AI 能力引擎、ECharts 图表体系、流式输出交互 |
| 3 | 安嘉乐 | 2442201104 | 工程与自动部署 | Mock 服务端、CI/CD 流水线、构建与多平台发布 |

### 指导教师（2 名）

| 序号 | 姓名 | 职称 | 单位 | 指导方向 |
| --- | --- | --- | --- | --- |
| 1 | 赵吉 | 工程师 | 西安汽车职业大学 | 技术架构与工程规范 |
| 2 | 李路星 | 助教 | 西安汽车职业大学 | 学情业务规则与教学场景设计 |

### 联系方式

- 学校：西安汽车职业大学
- 项目部署公网地址（Cloudflare Pages）：https://weak-point-vue-auto.pages.dev/
- 备用地址（GitHub Pages）：https://95189111.github.io/xiwei-weak-point-diagnosis/
- 代码仓库：https://github.com/95189111/xiwei-weak-point-diagnosis

## 项目简介

一线教学中普遍"考得勤、看得粗"：测验一场接一场，成绩只停留在分数排名，教师很难回答三个问题——**哪个知识点全班都没掌握？是哪个学生拖了后腿？补过之后到底会不会了？** 析微解决的就是这条断链：学情导入把分散的成绩数据归集到知识点维度；掌握度模型给出可量化的三档判定；靶向练习按薄弱点自动组卷；干预跟踪以状态机管理"诊断—干预—复查—销号"全过程，让每个薄弱点都有始有终。

### 平台功能概览

| 角色 | 核心能力 |
| --- | --- |
| 教师 | 工作台看板、学情导入、薄弱诊断与复核、靶向练习创建与发布、干预跟踪、AI 教学助手 |
| 教研组长 | 班级对比分析、薄弱分布与趋势、讲评报告导出、教师工作量统计 |
| 管理员 | 账号与班级管理、薄弱/临界阈值与复查周期配置、操作日志审计 |

### 教学业务闭环

```
测 → 诊 → 练 → 跟
```

① 学情导入：按班级批量录入测验成绩，自动校验与归档
② 薄弱识别：掌握度模型三档判定，生成可复核的诊断单
③ 靶向练习：按薄弱知识点自动/手动组卷，发布后回收正确率
④ 干预跟踪：干预单状态机流转，到期复查联动销号，全程留痕

---

## 技术架构

### 整体结构

```
表现层    src/views + src/components   Element Plus 2.8 + ECharts 5，10 个业务视图
   ↓
状态层    src/stores                  Pinia 2 · 认证态 Store（Token / 用户信息）
   ↓
接口层    src/api                     HTTP 语义客户端 → Mock 路由分发，模拟网络时延
   ↓
模拟服务端  src/mock                   66 个 REST 接口 · METHOD+URL 模式路由表 · HMAC 风格 Token（TTL 8h）
   ↓
数据持久层  src/mock/db.js + localStorage  种子数据（班级/学生/知识点/成绩）+ 运行期数据回写
```

### 技术栈

| 分类 | 选型 |
| --- | --- |
| 前端框架 | Vue 3.5 + Composition API（`<script setup>`） |
| 构建工具 | **Vite 5** · 秒级冷启动 · 路由级代码分割 |
| 路由 | Vue Router 4 · Hash 模式（任意静态托管零配置）+ 登录守卫 |
| 状态管理 | Pinia 2 |
| UI | Element Plus 2.8 + @element-plus/icons-vue |
| 图表 | ECharts 5（按需注册）· 掌握度分布 / 趋势 / 对比多视图 |
| 接口模拟 | 内嵌 Mock 服务端 · 路由表分发 · localStorage 持久化（键 `APP_DB_V2`） |
| AI 模块 | 本地 AI 能力引擎（基于真实业务数据合成）· Markdown 流式渲染（打字机效果，可停止/重新生成/复制） |
| 工程 | **GitHub Actions CI/CD** + Cloudflare Pages · 纯静态产物 |

### 目录结构

```
析微-学生薄弱知识点识别系统/
├── public/                      静态资源（favicon / _redirects SPA 回退）
├── src/
│   ├── ai/engine.js             AI 能力引擎（Mock 生成器，基于本地业务数据合成）
│   ├── api/                     index.js（HTTP 语义 → Mock 路由分发）· ai.js（流式客户端）
│   ├── mock/                    内置"后端"
│   │   ├── seed.js              种子数据（与原 Django 系统 seed_dump.json 同源）
│   │   ├── db.js                localStorage 持久化的内存数据库
│   │   ├── auth.js              HMAC 风格 Token（TTL 8h）
│   │   ├── index.js             METHOD + URL 模式路由表
│   │   └── handlers/            accounts / knowledge / exams / diagnosis / practice / analytics / ai
│   ├── components/              StatCard / LevelTag / ChartBase / AiMarkdown / AiStreamDialog / AiAssistant
│   ├── layouts/MainLayout.vue   主布局（侧边导航 + 顶栏 + AI 助手悬浮球）
│   ├── stores/auth.js           认证态 Store
│   ├── views/                   登录 / 工作台 / 知识点管理 / 学情导入 / 薄弱诊断 / 学生画像 / 靶向练习 / 干预跟踪 / 班级对比 / 系统设置
│   ├── router/index.js          10 路由 + 登录守卫 + 动态标题
│   ├── main.js                  Mock 启动 → 应用挂载
│   └── App.vue
├── .github/workflows/           deploy-pages.yml（push 到 main 自动构建发布）
├── vite.config.js               base: './'（任意子路径可托管）
└── package.json
```

### 接口清单（66 个）

| 模块 | 代表接口 | 说明 |
| --- | --- | --- |
| 认证与账号 | `POST /api/accounts/login` · `GET /api/accounts/me` · `GET/PUT /api/accounts/settings` | 登录签发 Token、当前用户、阈值与复查周期配置 |
| 知识点 | `GET/POST /api/knowledge/points` · `POST /api/knowledge/points/import` | 知识点树管理、批量导入、启停切换 |
| 学情考试 | `GET/POST /api/exams/batches` · `GET /api/exams/scores` | 成绩批次导入/校验/归档、分数查询 |
| 薄弱诊断 | `POST /api/diagnosis/diagnoses/detect` · `GET /api/diagnosis/classes/:id/weak-map` | 一键识别、确认/销号、班级薄弱热力图 |
| 靶向练习 | `POST /api/practice/practices/create` · `PUT /api/practice/practices/:id/result` | 组卷、发布、回收二次正确率 |
| 干预跟踪 | `GET/POST /api/practice/interventions` · `GET /api/practice/interventions/overdue` | 干预单流转、到期复查提醒、教师工作量 |
| 统计分析 | `GET /api/analytics/dashboard` · `GET /api/analytics/trend` · `GET /api/analytics/export` | 看板指标、趋势对比、讲评报告导出 |
| AI 能力 | `POST /api/ai/briefing` · `POST /api/ai/explain-diagnosis` · `POST /api/ai/chat` 等 6 项 | 教学简报、归因解读、学情评语、智能组卷、讲评报告、全局对话 |

> 以上接口全部由内嵌 Mock 服务端在前端进程内响应，**无需启动任何后端服务**；数据保存于浏览器 localStorage（键 `APP_DB_V2`），系统设置页可一键重置阈值与种子数据。

---

## 核心亮点：Push 即发布，代码提交自动上线

本项目工程化的最大特色是 **"代码 push 以后自动更新"的全自动部署流水线**，双线路互备，全程零人工干预：

```
git push → main 分支
   ├── 线路一：GitHub Actions（.github/workflows/deploy-pages.yml）
   │     自动拉取代码 → npm ci → npm run build → 发布到 GitHub Pages
   │     约 1 分钟后线上更新，支持 workflow_dispatch 手动触发
   └── 线路二：Cloudflare Pages（连接 Git 仓库监听）
         同步感知 push → 自动构建 dist/ → 全球 CDN 分发，作为国内备用线路
```

- **持续交付**：每次推送即一次发布，历史版本可由平台回滚，竞赛演示现场改 bug、现场上线
- **双线路互备**：GitHub Pages 与 Cloudflare Pages 同时更新，任一线路可达即演示不中断
- **纯静态产物**：Mock 服务端内嵌前端，无需服务器与数据库，任意静态托管平台均可部署

### 其他亮点

- **掌握度量化模型**：班级得分率 × 0.62 + 知识点基准 × 0.38 − 趋势罚分（连续下滑扣分），夹取 [15, 98]，可解释、可调参
- **业务幂等设计**：同知识点+班级已有待复核/已确认诊断时刷新原单，杜绝重复诊断单
- **状态机闭环**：诊断 待复核→已确认→已推送→已销号；干预 待开始→进行中→已复查→已销号（复查达标联动关闭诊断单）
- **AI 全场景渗透**：简报、归因、评语、组卷、讲评、对话 6 大 AI 能力，统一流式输出体验

---

## 安装与运行

### 环境要求

- Node.js **18+**（已验证 20/22）
- npm **9+**
- 现代浏览器（Chrome / Edge / Safari）

### 快速开始

```bash
# 1. 进入项目根目录（本 README 所在目录）
cd 析微-学生薄弱知识点识别系统   # 提交包内对应 析微-学生薄弱知识点识别系统-源码

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
# 打开浏览器访问 http://localhost:5173
```

### 生产构建

```bash
npm run build
# 产物在 dist/
```

### 部署

- **自动部署（已启用）**：push 到 `main` 分支，GitHub Actions 与 Cloudflare Pages 自动构建更新
- **手动部署**：`dist/` 目录可直接拖拽上传至任意静态托管平台

### 演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 教研组长 | `leader01` | `Leader@2026` |
| 管理员 | `admin` | `Admin@2026` |

### 常用命令

```bash
npm run dev        # 开发（http://localhost:5173）
npm run build      # 生产构建 → dist/
npm run preview    # 本地预览构建产物
```

---

## 版本与许可

- 当前版本：**v2.0 · Vue3 重构版**
- 最后更新：2026-11-10
