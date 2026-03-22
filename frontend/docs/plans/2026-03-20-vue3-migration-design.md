# Vue3 + JavaScript Migration Design (保持 UI/功能)

## 目标
在不改变现有 UI 展现与业务功能的前提下，将当前项目从 React（React Router + antd(React) + zustand + react-markdown）迁移到 Vue 3 + Vite（Vue Router + Ant Design Vue + 状态管理 + Markdown 渲染），并将源码从 TypeScript 降为 JavaScript。

## 当前现状（用于对齐范围）
- 入口：`src/main.tsx`（ReactDOM 挂载）
- 路由：`src/App.tsx`（`react-router-dom`，含登录、鉴权、admin/annotator 规则）
- 状态：`src/store/authStore.ts`（`zustand` + `localStorage`）
- UI：`antd`（React 版）与 `@ant-design/icons`
- Markdown：`react-markdown`
- API：`src/api/*`（axios + 拦截器，token 附加、401/409 跳登录）

## 迁移原则（保证“UI/功能不变”）
1. 先保证路由与鉴权逻辑 1:1 对齐（登录页、主布局、admin 与 annotator 限制）
2. 再保证数据流与副作用一致（例如：每 30s 心跳 `/auth/me`、抽屉打开拉取日志/历史、复制逻辑、弹窗文案等）
3. UI 逐组件替换为 Ant Design Vue 对应组件，尽量保持现有布局与内联样式
4. Markdown 渲染替换为可等价输出的实现（通过 CSS/类名保持视觉一致）
5. 最后统一移除 TS（`.ts/.tsx` -> `.js/.jsx`），保留运行时逻辑一致

## 推荐方案
采用 Vue 3 + Vite SPA，使用：
- `vue-router`：替代 `react-router-dom`
- `pinia`：替代 `zustand`（仍使用 `localStorage` 作为持久化）
- `ant-design-vue`：替代 `antd`（React）
- Markdown：用 `marked`（配合自定义 Vue 组件）替代 `react-markdown`

## 关键映射表
### 路由与布局
- `src/App.tsx` 的 routes 映射到 Vue Router：
  - `/login`
  - `/` 作为受鉴权的父路由，子路由：
    - `/` -> Home
    - `/apps` -> AppsList
    - `/apps/:appId` -> AppDetail
    - `/history` -> History（annotator 禁止）
    - `/admin/users` / `/admin/template` / `/admin/stats` -> Admin 组（admin 才可访问）
- `MainLayout` -> Vue 版布局组件（左侧栏 + 用户信息 + 修改密码弹窗 + `router-view`）
- `AuthGuard` -> Vue Router 守卫或鉴权组件（包含：
  - 无 token/user -> 重定向 `/login`
  - role 限制：admin/annotator 逻辑
  - token 存在时的 30s 心跳 `/auth/me`
 ）

### 状态
- `src/store/authStore.ts` 的语义在 Pinia 中复刻：
  - `user`、`token`
  - `setAuth(user, token)`：写入 `localStorage`
  - `clearAuth()`：清空并更新状态

### axios 与拦截器
- 保留现有 `src/api/client.ts` 的 axios 拦截器逻辑（token 附加、401/409 处理）
- Vue 代码中只改调用方式，尽量不动 API 层文件与返回结构

### UI 组件与交互
React antd 中用到的典型组件/能力在 Vue 中映射：
- `Modal.confirm` / `Modal`：对应 Vue 的 `Modal` 与 `Modal.confirm`
- `Drawer`：对应 Vue 的 `Drawer`
- `Input/Search`、`Select`、`Tag`、`Spin`、`Alert`、`Dropdown`：逐一换成 Vue 版
- `message.success/error`：保留原交互（显示时机、文案）

Icons：
- React 的 `@ant-design/icons` 替换为 Ant Design Vue 对应的 icons 方案（按组件库实际可用的方式引入）

### Markdown 渲染
- `react-markdown` 替换为 Vue 内部的 Markdown 渲染器：
  - 使用 `marked` 生成 HTML
  - 保留当前 `.prompt-markdown`、`.markdown-body` 类名以维持视觉
  - 注意：若现有内容包含安全风险（XSS），需对 HTML 做处理；若原项目默认没有风险输入，可先保持等价渲染策略并在实现阶段复核

## 目录结构建议（迁移后）
- `src/main.js`：Vue 挂载入口
- `src/App.js`：Vue Router 与根布局
- `src/router/index.js`：路由表与鉴权逻辑
- `src/store/authStore.js`：Pinia store
- `src/pages/**`：每个页面迁移为 Vue SFC（或 Vue JSX，视最终方案）
- `src/components/**`：UI 组件迁移为 Vue SFC
- `src/api/**`：尽量保留，必要时改为 `.js`

## 验收标准（成功标准）
1. 页面路径与路由行为与 React 版本一致（包括默认重定向 `* -> /`）
2. 登录鉴权一致（token/user 不存在、admin/annotator 限制）
3. 心跳与互踢行为一致（30s `/auth/me`、409 互踢弹窗 + 跳登录）
4. 核心功能一致：
   - 登录、改密码、退出登录
   - Home：语音识别、提示词生成、复制、预览弹窗
   - Apps 管理：列表、筛选、抽屉详情、构建日志轮询、上传/更新/删除、停止/启动
   - History：历史记录与文件下载（若存在）
   - Admin：用户管理/模板管理/统计页
5. UI 外观与布局稳定：尽量保持现有内联样式与 AntD 组件风格一致

## 风险与注意点
- 本项目当前依赖/配置存在 React 与 Vue 混用迹象（例如 `vite.config.ts` 使用了 React 插件）；迁移实现时需要同时整理构建配置与依赖，避免构建失败。
- `antd`（React）与 `ant-design-vue` 的组件 API 在细节上可能有差异；若出现行为不一致，需要在实现阶段逐点校准（尤其是 `Modal.confirm`、`Drawer` 的回调与受控/非受控字段）。
- TypeScript 去除后，类型安全消失；实现时需保证所有运行时字段的存在性（例如 `user.role`、`user.username`）。
