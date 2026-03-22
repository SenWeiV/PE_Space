import { createRouter, createWebHistory } from "vue-router";

import LoginPage from "@/pages/LoginPage/index.vue";
import MainLayout from "@/components/layout/MainLayout.vue";

import HomePage from "@/pages/HomePage/index.vue";
import AppsListPage from "@/pages/AppsListPage/index.vue";
import AppDetailPage from "@/pages/AppDetailPage/index.vue";
import HistoryPage from "@/pages/HistoryPage/index.vue";

import UserManagePage from "@/pages/admin/UserManagePage/index.vue";
import TemplateManagePage from "@/pages/admin/TemplateManagePage/index.vue";
import StatsPage from "@/pages/admin/StatsPage/index.vue";
import IntegrationSettingsPage from "@/pages/admin/IntegrationSettingsPage/index.vue";
import IpAllowlistPage from "@/pages/admin/IpAllowlistPage/index.vue";
import { getStoredUser } from "@/utils/authStorage";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginPage },
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", name: "home", component: HomePage },
        { path: "apps", name: "apps", component: AppsListPage },
        // 仅匹配数字 id，避免与 Streamlit 的 /apps/{slug}/ 冲突（slug 非数字时不再误进详情页后被重定向）
        { path: "apps/:appId(\\d+)", name: "appDetail", component: AppDetailPage },
        { path: "history", name: "history", component: HistoryPage, meta: { forbidAnnotator: true } },
        {
          path: "admin/users",
          name: "adminUsers",
          component: UserManagePage,
          meta: { requireAdmin: true },
        },
        {
          path: "admin/template",
          name: "adminTemplate",
          component: TemplateManagePage,
          meta: { requireAdmin: true },
        },
        {
          path: "admin/stats",
          name: "adminStats",
          component: StatsPage,
          meta: { requireAdmin: true },
        },
        {
          path: "admin/integration",
          name: "adminIntegration",
          component: IntegrationSettingsPage,
          meta: { requireAdmin: true },
        },
        {
          path: "admin/ip-allowlist",
          name: "adminIpAllowlist",
          component: IpAllowlistPage,
          meta: { requireAdmin: true },
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("token");
  const user = getStoredUser();

  if (to.path !== "/login" && (!token || !user)) {
    return next({ path: "/login" });
  }

  if (to.meta?.requireAdmin && user?.role !== "admin") {
    return next({ path: "/" });
  }

  if (to.meta?.forbidAnnotator && user?.role === "annotator") {
    return next({ path: "/" });
  }

  return next();
});

export default router;

