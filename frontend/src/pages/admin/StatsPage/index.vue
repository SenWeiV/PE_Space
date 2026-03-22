<template>
  <div>
    <StatsPageHeader />

    <StatsOverviewSection :items="overviewItems" />

    <StatsAppRankSection :apps="sortedApps" :icon-for="getAppIcon" @select="selectedApp = $event" />

    <!-- Drawer -->
    <a-drawer
      :title="selectedApp ? `${selectedApp.name} - 使用详情` : ''"
      :open="!!selectedApp"
      :width="480"
      @close="selectedApp = null"
    >
      <div v-if="selectedApp">
        <div class="st-drawer-stats">
          <div v-for="item in selectedAppOverview" :key="item.label" class="st-drawer-stat">
            <div class="st-drawer-stat-value">{{ item.value }}</div>
            <div class="st-drawer-stat-label">{{ item.label }}</div>
          </div>
        </div>

        <div class="st-block-title">用户使用明细</div>
        <div v-if="selectedAppUsers.length === 0" class="st-drawer-empty">暂无使用记录</div>
        <div v-else class="st-user-list">
          <div v-for="u in selectedAppUsers" :key="u.username" class="st-user-row">
            <div class="st-user-name">{{ u.username }}</div>
            <div class="st-user-metrics">
              <span>访问 <b class="st-user-num">{{ u.view_count }}</b></span>
              <span>运行 <b class="st-user-num">{{ u.run_count }}</b></span>
              <span>合计 <b class="st-user-num">{{ u.view_count + u.run_count }}</b></span>
            </div>
          </div>
        </div>
      </div>
    </a-drawer>

    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="apps">
        <template #tab>
          <BarChartOutlined /> 应用统计
        </template>
        <a-table
          row-key="id"
          :columns="appColumns"
          :data-source="appStats"
          :loading="loading"
          :pagination="{ pageSize: 20 }"
        />
      </a-tab-pane>

      <a-tab-pane key="users">
        <template #tab>用户统计</template>
        <a-table
          row-key="id"
          :columns="userColumns"
          :data-source="userStats"
          :loading="loading"
          :pagination="{ pageSize: 20 }"
        />
      </a-tab-pane>

      <a-tab-pane key="detail">
        <template #tab>
          <TeamOutlined /> 使用明细
        </template>
        <a-table
          :row-key="getUsageRowKey"
          :columns="detailColumns"
          :data-source="usageDetail"
          :loading="loading"
          :pagination="{ pageSize: 20 }"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { computed, h, onMounted, ref } from "vue";
import dayjs from "dayjs";
import client from "@/api/client";
import { Tag } from "ant-design-vue";
import { BarChartOutlined, TeamOutlined } from "@ant-design/icons-vue";
import StatsPageHeader from "./StatsPageHeader.vue";
import StatsOverviewSection from "./StatsOverviewSection.vue";
import StatsAppRankSection from "./StatsAppRankSection.vue";

const APP_ICONS = ["📊", "🎨", "🔧", "📝", "🎯", "🔍", "💡", "🚀", "⚡", "🛠"];

const loading = ref(false);
const appStats = ref([]);
const userStats = ref([]);
const usageDetail = ref([]);
const selectedApp = ref(null);
const activeTab = ref("apps");

const fetchStats = async () => {
  loading.value = true;
  try {
    const res = await client.get("/stats");
    appStats.value = res.data.apps || [];
    userStats.value = res.data.users || [];
    usageDetail.value = (res.data.usage_detail || []).filter((d) => d.username !== "anonymous");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStats();
});

const statusColor = {
  running: "green",
  stopped: "default",
  error: "red",
};
const statusLabel = {
  running: "运行中",
  stopped: "已停止",
  error: "错误",
};
const roleColor = {
  admin: "purple",
  user: "blue",
  annotator: "orange",
};
const roleLabel = {
  admin: "管理员",
  user: "普通用户",
  annotator: "标注账号",
};

const totalViews = computed(() => appStats.value.reduce((s, a) => s + a.view_count, 0));
const totalViewUsers = computed(
  () => new Set(usageDetail.value.filter((d) => d.view_count > 0).map((d) => d.username)).size,
);

const overviewItems = computed(() => [
  { label: "应用总数", value: appStats.value.length, icon: "📦" },
  { label: "用户总数", value: userStats.value.length, icon: "👥" },
  { label: "平台访问总次数", value: totalViews.value, icon: "👁" },
  { label: "平台访问总人数", value: totalViewUsers.value, icon: "🧑‍💻" },
]);

const sortedApps = computed(() => {
  return [...appStats.value].sort((a, b) => b.run_count - a.run_count || b.view_count - a.view_count);
});

const selectedAppUsers = computed(() => {
  if (!selectedApp.value) return [];
  return usageDetail.value
    .filter((d) => d.app_id === selectedApp.value.id && d.username !== "anonymous")
    .sort((a, b) => b.view_count + b.run_count - (a.view_count + a.run_count));
});

const selectedAppOverview = computed(() => [
  { label: "访问次数", value: selectedApp.value?.view_count ?? 0 },
  { label: "访问人数", value: selectedApp.value?.view_users ?? 0 },
  { label: "运行次数", value: selectedApp.value?.run_count ?? 0 },
]);

const getAppIcon = (id) => APP_ICONS[id % APP_ICONS.length];

const appColumns = computed(() => [
  { title: "应用名称", dataIndex: "name", key: "name", ellipsis: true },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    customRender: ({ text }) =>
      h(Tag, { color: statusColor[text] ?? "default" }, () => statusLabel[text] ?? text),
  },
  { title: "所有者", dataIndex: "owner", key: "owner" },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    customRender: ({ text }) => h("span", null, dayjs(text).format("YYYY-MM-DD")),
  },
  { title: "访问次数", dataIndex: "view_count", key: "view_count" },
  { title: "访问人数", dataIndex: "view_users", key: "view_users" },
  { title: "运行次数", dataIndex: "run_count", key: "run_count" },
  { title: "运行人数", dataIndex: "run_users", key: "run_users" },
]);

const userColumns = computed(() => [
  { title: "用户名", dataIndex: "username", key: "username" },
  {
    title: "角色",
    dataIndex: "role",
    key: "role",
    customRender: ({ text }) => h(Tag, { color: roleColor[text] ?? "default" }, () => roleLabel[text] ?? text),
  },
  {
    title: "状态",
    dataIndex: "is_active",
    key: "is_active",
    customRender: ({ text }) => h(Tag, { color: text ? "green" : "red" }, () => (text ? "正常" : "禁用")),
  },
  { title: "上传应用数", dataIndex: "upload_count", key: "upload_count" },
  { title: "访问次数", dataIndex: "view_count", key: "view_count" },
  { title: "运行次数", dataIndex: "run_count", key: "run_count" },
]);

const usageDetailFilters = computed(() => {
  const usernames = Array.from(new Set(usageDetail.value.map((d) => d.username)));
  const appNames = Array.from(new Set(usageDetail.value.map((d) => d.app_name)));
  return { usernames, appNames };
});

const detailColumns = computed(() => [
  {
    title: "用户名",
    dataIndex: "username",
    key: "username",
    filters: usageDetailFilters.value.usernames.map((u) => ({ text: u, value: u })),
    onFilter: (value, record) => record.username === value,
  },
  {
    title: "应用名称",
    dataIndex: "app_name",
    key: "app_name",
    ellipsis: true,
    filters: usageDetailFilters.value.appNames.map((n) => ({ text: n, value: n })),
    onFilter: (value, record) => record.app_name === value,
  },
  {
    title: "访问次数",
    dataIndex: "view_count",
    key: "view_count",
    customRender: ({ text }) => h("span", { class: "stats-table-strong" }, text),
  },
  {
    title: "运行次数",
    dataIndex: "run_count",
    key: "run_count",
    customRender: ({ text }) => h("span", { class: "stats-table-strong" }, text),
  },
  {
    title: "合计",
    key: "total",
    customRender: ({ record }) =>
      h("span", { class: "stats-table-strong" }, record.view_count + record.run_count),
    sorter: (a, b) => a.view_count + a.run_count - (b.view_count + b.run_count),
  },
]);

const getUsageRowKey = (r) => `${r.username}-${r.app_id}`;
</script>

<style scoped>
.st-drawer-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.st-drawer-stat {
  flex: 1 1 90px;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
}

.st-drawer-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
}

.st-drawer-stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.st-drawer-empty {
  color: #bbb;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.st-user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.st-user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid #f0f0f0;
}

.st-user-name {
  font-weight: 500;
  font-size: 14px;
  color: #1a1a1a;
}

.st-user-metrics {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
}

.st-user-num {
  color: #1a1a1a;
  font-weight: 600;
}
</style>

<style>
/* a-table customRender 挂载在表格 DOM 内，非本组件 scoped 子树 */
.stats-table-strong {
  font-weight: 600;
}
</style>
