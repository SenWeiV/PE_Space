<template>
  <div class="ml-root">
    <!-- 左侧栏 -->
    <aside class="ml-aside">
      <!-- Logo -->
      <div class="ml-logo-wrap">
        <div class="ml-logo-row">
          <div class="ml-logo-mark">AS</div>
          <div>
            <div class="ml-logo-title">APP STORE</div>
            <div class="ml-logo-sub">PLATFORM</div>
          </div>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="ml-nav">
        <template
          v-for="item in allNavItems"
          :key="item.type === 'divider' ? 'divider-' + item.key : item.path"
        >
          <div
            v-if="item.type !== 'divider'"
            class="ml-nav-item"
            :class="{ 'ml-nav-item--active': isActive(item.path) }"
            @click="router.push(item.path)"
          >
            <span class="ml-nav-icon" :class="{ 'ml-nav-icon--active': isActive(item.path) }">
              <component :is="item.icon" />
            </span>
            <span>{{ item.label }}</span>
          </div>

          <div v-else class="ml-nav-divider" />
        </template>
      </nav>

      <!-- 用户信息 + 操作 -->
      <div class="ml-footer">
        <div class="ml-user-row">
          <div class="ml-avatar">
            {{ (user?.username?.[0] || "").toUpperCase() }}
          </div>
          <div>
            <div class="ml-user-name">{{ user?.username }}</div>
            <div class="ml-user-role">
              {{ roleLabel[user?.role] || user?.role || "user" }}
            </div>
          </div>
        </div>

        <div class="ml-actions">
          <button type="button" class="ml-action-btn" title="修改密码" @click="pwModalOpen = true">
            <LockOutlined class="ml-action-icon" />
            修改密码
          </button>

          <button type="button" class="ml-action-btn" title="退出登录" @click="confirmLogout">
            <LogoutOutlined class="ml-action-icon" />
            退出登录
          </button>
        </div>
      </div>
    </aside>

    <!-- 主内容 -->
    <main class="ml-main">
      <router-view />
    </main>

    <!-- 修改密码弹窗 -->
    <a-modal
      title="修改密码"
      :open="pwModalOpen"
      :confirm-loading="pwLoading"
      ok-text="确认修改"
      cancel-text="取消"
      :width="400"
      @cancel="() => closePwModal()"
      @ok="handleChangePassword"
    >
      <div class="ml-pw-form">
        <div>
          <div class="ml-pw-label">原密码</div>
          <a-input-password v-model:value="oldPassword" class="ml-pw-input" placeholder="请输入原密码" />
        </div>

        <div>
          <div class="ml-pw-label">新密码</div>
          <a-input-password
            v-model:value="newPassword"
            class="ml-pw-input"
            placeholder="请输入新密码（至少 6 位）"
          />
        </div>

        <div>
          <div class="ml-pw-label">确认新密码</div>
          <a-input-password v-model:value="confirmPassword" class="ml-pw-input" placeholder="再次输入新密码" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Modal, message } from "ant-design-vue";
import client from "@/api/client";
import { logout, changePassword } from "@/api/auth";
import { getStoredUser } from "@/utils/authStorage";
import {
  HomeOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  UserOutlined,
  FileTextOutlined,
  BarChartOutlined,
  KeyOutlined,
  SecurityScanOutlined,
  LockOutlined,
  LogoutOutlined,
} from "@ant-design/icons-vue";

const router = useRouter();
const route = useRoute();

// 角色映射：保持 React 版文案
const roleLabel = {
  admin: "管理员",
  user: "普通用户",
  annotator: "标注账号",
};

const user = ref(null);
const loadUser = () => {
  user.value = getStoredUser();
};

const HEARTBEAT_MS = 30_000;
let timer = null;

const token = localStorage.getItem("token");
loadUser();

const isActive = (path) => {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
};

const isAdmin = computed(() => user.value?.role === "admin");
const isAnnotator = computed(() => user.value?.role === "annotator");

const pwModalOpen = ref(false);
const pwLoading = ref(false);
const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

const closePwModal = () => {
  pwModalOpen.value = false;
  pwLoading.value = false;
  oldPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
};

const handleChangePassword = async () => {
  const oldPw = oldPassword.value;
  const newPw = newPassword.value;
  const confirmPw = confirmPassword.value;

  if (!oldPw || !newPw || !confirmPw) {
    message.error("请输入完整密码信息");
    return;
  }

  if (newPw !== confirmPw) {
    message.error("两次密码不一致");
    return;
  }

  pwLoading.value = true;
  try {
    await changePassword(oldPw, newPw);
    message.success("密码修改成功");
    closePwModal();
  } catch (e) {
    message.error(e?.response?.data?.detail || "修改失败");
  } finally {
    pwLoading.value = false;
  }
};

const confirmLogout = () => {
  Modal.confirm({
    title: "确认退出登录？",
    okText: "退出",
    cancelText: "取消",
    onOk: async () => {
      await handleLogout();
    },
  });
};

const handleLogout = async () => {
  try {
    await logout();
  } catch {
    // ignore
  }

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  user.value = null;
  router.push("/login");
};

const navItems = computed(() => [
  { path: "/", icon: HomeOutlined, label: "首页" },
  { path: "/apps", icon: AppstoreOutlined, label: "应用管理" },
  ...(isAnnotator.value ? [] : [{ path: "/history", icon: HistoryOutlined, label: "历史记录" }]),
]);

const adminMenuItems = computed(() => [
  { path: "/admin/users", icon: UserOutlined, label: "用户管理" },
  { path: "/admin/template", icon: FileTextOutlined, label: "代码规范Prompt" },
  { path: "/admin/integration", icon: KeyOutlined, label: "集成与密钥" },
  { path: "/admin/ip-allowlist", icon: SecurityScanOutlined, label: "IP 白名单" },
  { path: "/admin/stats", icon: BarChartOutlined, label: "使用统计" },
]);

const allNavItems = computed(() => {
  const list = [];
  list.push(...navItems.value);
  if (isAdmin.value) {
    list.push({ type: "divider", key: "admin-divider" });
    list.push(...adminMenuItems.value);
  }
  return list;
});

onMounted(() => {
  // 刷新一次，确保登录后 sidebar 角色即时可见
  loadUser();
  if (!token) return;
  timer = setInterval(() => {
    client.get("/auth/me").catch(() => {});
  }, HEARTBEAT_MS);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.ml-root {
  display: flex;
  min-height: 100vh;
  background: #fafafa;
}

.ml-aside {
  position: fixed;
  left: 0;
  top: 0;
  width: 240px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.ml-logo-wrap {
  padding: 32px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.ml-logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ml-logo-mark {
  width: 40px;
  height: 40px;
  background: #2c2c2c;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.5px;
}

.ml-logo-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.ml-logo-sub {
  font-size: 11px;
  color: #999;
  letter-spacing: 0.3px;
}

.ml-nav {
  flex: 1;
  padding: 16px 12px;
  overflow: hidden;
}

.ml-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, font-weight 0.2s;
  user-select: none;
}

.ml-nav-item:hover:not(.ml-nav-item--active) {
  background: #f7f7f7;
}

.ml-nav-item--active {
  font-weight: 600;
  color: #1a1a1a;
  background: #f0f0f0;
}

.ml-nav-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
  color: #86909c;
}

.ml-nav-icon--active {
  color: #165dff;
}

.ml-nav-divider {
  border-top: 1px solid #f0f0f0;
  margin: 8px 4px;
}

.ml-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid #f0f0f0;
}

.ml-user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ml-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2c2c2c, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.ml-user-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.ml-user-role {
  font-size: 11px;
  color: #999;
}

.ml-actions {
  display: flex;
  gap: 8px;
}

.ml-action-btn {
  flex: 1;
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #f7f7f7;
  color: #555;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.ml-action-btn:hover {
  background: #efefef;
}

.ml-action-icon {
  font-size: 12px;
}

.ml-main {
  margin-left: 240px;
  flex: 1;
  padding: 0 48px 80px;
  min-height: 100vh;
}

.ml-pw-form {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ml-pw-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.ml-pw-input :deep(.ant-input),
.ml-pw-input :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
}
</style>
