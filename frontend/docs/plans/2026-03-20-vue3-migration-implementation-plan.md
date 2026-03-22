# Vue3 + JavaScript Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变 UI 展现与业务功能的前提下，把当前 React（React Router + antd(React) + zustand + react-markdown）的前端迁移到 Vue 3 + Vite（Vue Router + Ant Design Vue + Pinia + Markdown 渲染），并将源码降为 JavaScript。

**Architecture:** 使用 Vue3 SFC（`*.vue`）和组合式 API（Composition API）。路由与鉴权使用 Vue Router；状态用 Pinia（持久化到 `localStorage`，语义对齐现有 `authStore`）；API 层继续复用 axios 拦截器逻辑；UI 使用 Ant Design Vue；Markdown 渲染使用 `marked` + 自定义 Vue 组件以对齐样式。

**Tech Stack:** Vue 3, Vite, Vue Router 4, Pinia 2, axios, Ant Design Vue 4.2.x, marked, dayjs

---

## Task 0: 基线检查（确认当前可构建性）
**Files:**
- Modify: `package.json`（依实现需要）
- Check: build output

**Step 1: Run build**
Run: `npm run build`
Expected: 若失败，记录失败原因（通常是 React 依赖/ReactMarkdown 等缺失）。

**Step 2: 修正仅为迁移准备的必要依赖（不改功能）**
- 计划在后续 Task 1 完成依赖整理；此处只记录基线。

---

## Task 1: 依赖与构建配置整理（Vue3-only）
**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`（或替换为 `vite.config.js`）
- Remove: React 相关插件/依赖（按迁移需要）

**Step 1: 检查当前 Vite 插件**
目前 `vite.config.ts` 使用了 `@vitejs/plugin-react`，但 `package.json` 只有 `@vitejs/plugin-vue`。

**Step 2: 使 Vite 只使用 Vue 插件**
- 将 `vite.config.ts` 改为使用 `@vitejs/plugin-vue`
- 保留 alias `@ -> ./src`
- 保留 `server.proxy` 配置

**Step 3: 安装迁移所需 Vue 依赖**
- 安装 `marked`
- 按 `ant-design-vue` 的文档补齐 icons 包（常见为 `@ant-design/icons-vue`，如缺失则安装）

**Step 4: Run build**
Run: `npm run build`
Expected: 仍可能失败（因为源码尚未迁移），但不会因为 Vue 构建工具链问题失败。

---

## Task 2: Vue 入口与根组件替换
**Files:**
- Modify: `index.html`（仅确认 root id）
- Create: `src/main.js`
- Create: `src/App.js`
- Modify/Remove: `src/main.tsx`, `src/App.tsx`（迁移后可删除或保留到最后）

**Step 1: 建立 Vue mount**
- 用 `createApp` 挂载
- 引入 `router`
- 引入 Ant Design Vue（并配置 locale/theme，如有需求）

**Step 2: 创建 Vue 路由实例（占位，先能跑起来）**
- 先实现最基础路由：`/login` 和 `/`（不包含鉴权）

**Step 3: Run dev**
Run: `npm run dev`
Expected: 页面能打开 `/` 与 `/login`（即便内容尚未完成迁移）

---

## Task 3: 状态管理迁移（zustand -> Pinia）
**Files:**
- Modify: `src/store/authStore.ts` -> `src/store/authStore.js`
- Create: `src/stores/auth.js`（如你更偏好目录命名，建议语义保持一致）

**Step 1: Pinia store 复刻现有语义**
- state：`user`, `token`
- action：`setAuth(user, token)` 写入 localStorage 并更新 state
- action：`clearAuth()` 清空 localStorage 并更新 state

**Step 2: Run build**
Run: `npm run build`
Expected: JS 编译通过（不要求业务完全一致）

---

## Task 4: 路由鉴权与心跳（AuthGuard）
**Files:**
- Create: `src/router/index.js`（Vue Router 路由表与守卫）
- Modify: 或移植：`src/components/layout/AuthGuard.tsx` -> `src/components/layout/AuthGuard.vue`（如果做成组件）

**Step 1: 编写鉴权逻辑**
- token/user 缺失：重定向 `/login`
- `requireAdmin`：非 admin -> 重定向 `/`
- `forbidAnnotator`：annotator -> 重定向 `/`

**Step 2: 保留 30s 心跳**
- 使用复用 axios client：定时请求 `/auth/me`
- 保留 409/401 的弹窗/跳转行为（由 axios 拦截器处理）

**Step 3: Map `Outlet`**
- 用 Vue Router 的嵌套路由，在 `/` 父路由下放置子页面。

**Step 4: Run manual check**
- 在无 token 情况打开 `/`：应重定向 `/login`
- 有 token 且 role 不符：应重定向 `/`

---

## Task 5: Markdown 渲染组件（react-markdown -> marked）
**Files:**
- Create: `src/components/MarkdownView.vue`（或 `.js` + template）
- Modify: `src/components/PromptCard`、`RulesPanel`、以及任何渲染 Markdown 的位置

**Step 1: 生成等价渲染**
- 用 `marked` 把 markdown 转为 HTML
- 使用 `v-html` 渲染
- 保持类名：`prompt-markdown` / `markdown-body`

**Step 2: Run build**
Run: `npm run build`

---

## Task 6: UI 组件迁移（antd(React) -> Ant Design Vue）
**Files（逐个迁移）:**
- `src/components/layout/MainLayout` -> `src/components/layout/MainLayout.vue`
- `src/components/layout/AuthGuard` -> `src/components/layout/AuthGuard.vue`（或仅用路由守卫）
- `src/components/UploadModal` -> `.vue`
- `src/components/PromptCard` -> `.vue`

**Step 1: 建立 Ant Design Vue 组件映射**
- `Form`/`Input`/`Modal`/`Drawer`/`Select`/`Tag`/`Spin`/`Alert`/`Dropdown`/`message`
- 注意：React 里 `message` 是模块 API；Vue 里可能是全局方法或实例方法，按 AntD Vue 文档调整。

**Step 2: 交互校准**
- `Modal.confirm` 的 `onOk/onCancel` 行为
- `Drawer` 的 open/close 与回调
- `Form` 的 `onFinish`、`form.validateFields` 对齐 Vue 表单校验方式

**Step 3: Run build + 手动点测**
至少覆盖：登录、主布局菜单切换、修改密码弹窗、退出登录弹窗。

---

## Task 7: 页面迁移（逐页替换）
**Files（按从简单到复杂顺序）:**
1. `src/pages/LoginPage.tsx` -> `src/pages/LoginPage.vue`
2. `src/pages/HomePage/index.tsx` 及其子组件/ hooks：
   - `RequirementEditor.vue`
   - `RulesPanel.vue`
   - `SpeechBar.vue`
   - `BottomBar.vue`
   - `PromptPreviewModal.vue`
   - hooks：`useSpeechRecognition.js`, `usePromptActions.js`
3. `src/pages/AppsListPage.tsx` -> `src/pages/AppsListPage.vue`
4. `src/pages/AppDetailPage.tsx` -> `src/pages/AppDetailPage.vue`
5. `src/pages/HistoryPage.tsx` -> `src/pages/HistoryPage.vue`
6. 管理后台：
   - `UserManagePage.tsx` -> `.vue`
   - `TemplateManagePage.tsx` -> `.vue`
   - `StatsPage.tsx` -> `.vue`

**Step 1: 每页迁移都以“先能渲染+能跑通”作为阶段目标**
- 保持 route path 与页面功能一致
- 保持内联样式、文案、弹窗宽度/按钮文案一致

**Step 2: 每页迁移后运行检查**
- `npm run build`
- 打开相应页面执行关键操作（比如 Home 的复制/预览；Apps 的筛选/抽屉/停止启动；Admin 的列表操作）

---

## Task 8: TypeScript 降为 JavaScript（源码格式清理）
**Files:**
- `src/**/*.ts` -> `src/**/*.js`
- `src/**/*.tsx` -> `src/**/*.vue` 或 `.js`（按实际归属）
- `tsconfig.json`：如果完全转 JS，可删除或保留（不影响运行）

**Step 1: 移除类型**
- 删除接口类型声明（可用 runtime 校验/默认值替代）
- 删除泛型与 `React.*` 类型引用

**Step 2: Run build**
Run: `npm run build`
Expected: 无类型编译步骤错误（因为不再依赖 TS）

---

## Task 9: 最终验收（功能与 UI 对齐）
**Files:**
- 全局

**Step 1: Run build**
Run: `npm run build`

**Step 2: Run dev + 手动验收清单**
覆盖登录、鉴权跳转、菜单切换、心跳互踢、Home 语音/复制/预览、Apps 管理抽屉轮询、上传/更新/删除、History 下载、Admin 三个页面。

**Step 3: 最后清理无用 React 残留**
- 删除 React/路由/组件用不到的文件
- 确保 `vite.config`、`package.json` 与源码一致

---

## Execution Handoff
Plan complete and saved to `docs/plans/2026-03-20-vue3-migration-implementation-plan.md`.

Two execution options:
1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks.
2. Parallel Session (separate) - batch with checkpoints.

Which approach?

