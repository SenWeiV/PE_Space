<template>
  <div>
    <AppsListPageHeader :show-upload="apps.length > 0" @upload="uploadOpen = true" />

    <AppsListToolbar
      v-if="apps.length > 0"
      v-model:search="search"
      v-model:status-filter="statusFilter"
      :status-options="statusOptions"
      :show-filter-hint="!!(search || statusFilter !== 'all')"
      :filtered-count="filteredApps.length"
      :total-count="apps.length"
    />

    <div v-if="loading && apps.length === 0" class="al-loading">
      <a-spin />
    </div>

    <AppsListEmpty
      v-else-if="filteredApps.length === 0"
      :no-apps="apps.length === 0"
      @upload="uploadOpen = true"
    />

    <div v-else class="al-grid">
      <AppCard
        v-for="app in filteredApps"
        :key="app.id"
        :app="app"
        :can-manage="canManage(app)"
        :is-admin="isAdmin"
        :is-acting="actionLoading === app.id"
        :username="username"
        :on-stop="() => handleStop(app.id)"
        :on-restart="() => handleRestart(app.id)"
        :on-delete="() => handleDelete(app.id)"
        :on-detail="() => (detailApp = app)"
        :on-update="() => updateApp(app)"
        :on-edit="() => handleOpenEdit(app)"
      />
    </div>

    <AppDetailDrawer
      ref="detailDrawerRef"
      :open="!!detailApp"
      :app="detailApp"
      :drawer-status="drawerStatus"
      :username="username"
      :run-history="runHistory"
      :history-loading="historyLoading"
      :detail-log="detailLog"
      :log-loading="logLoading"
      :can-manage="detailApp ? canManage(detailApp) : false"
      @close="detailApp = null"
      @update-app="onDrawerUpdateApp"
      @stop="onDrawerStop"
      @restart="onDrawerRestart"
      @delete="confirmDelete"
    />

    <UploadModal :open="uploadOpen" :on-close="() => (uploadOpen = false)" :on-success="handleUploadSuccess" />

    <UploadModal
      :open="!!updateTarget"
      :on-close="() => (updateTarget = null)"
      :on-success="handleUploadSuccess"
      :target-app="updateTarget ? { id: updateTarget.id, name: updateTarget.name } : undefined"
    />

    <AppEditModal
      :open="!!editTarget"
      :app="editTarget"
      :edit-form="editForm"
      :edit-saving="editSaving"
      :owner-options="ownerSelectOptions"
      @close="editTarget = null"
      @save="handleSaveEdit"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { Modal, message } from "ant-design-vue";

import AppCard from "./AppCard.vue";
import AppsListPageHeader from "./AppsListPageHeader.vue";
import AppsListToolbar from "./AppsListToolbar.vue";
import AppsListEmpty from "./AppsListEmpty.vue";
import AppDetailDrawer from "./AppDetailDrawer.vue";
import AppEditModal from "./AppEditModal.vue";
import UploadModal from "@/components/UploadModal.vue";
import client from "@/api/client";
import {
  deleteApp,
  getAppHistory,
  getAppLogs,
  listApps,
  restartApp,
  stopApp,
  updateAppInfo,
} from "@/api/apps";
import { getStoredUser } from "@/utils/authStorage";

const apps = ref([]);
const loading = ref(false);
const uploadOpen = ref(false);
const updateTarget = ref(null);
const editTarget = ref(null);
const editForm = reactive({ name: "", description: "", owner_id: 0 });
const editSaving = ref(false);
const allUsers = ref([]);

const detailApp = ref(null);
const search = ref("");
const statusFilter = ref("all");
const actionLoading = ref(null);

const detailLog = ref("");
const logLoading = ref(false);
const runHistory = ref([]);
const historyLoading = ref(false);

const detailDrawerRef = ref(null);
let logTimer = null;
let pollTimer = null;

const authUser = ref(null);

const loadUser = () => {
  authUser.value = getStoredUser();
};

const username = computed(() => authUser.value?.username || "");
const isAdmin = computed(() => authUser.value?.role === "admin");

const ownerSelectOptions = computed(() => allUsers.value.map((u) => ({ value: u.id, label: u.username })));

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "running", label: "运行中" },
  { value: "stopped", label: "已停止" },
  { value: "building", label: "构建中" },
  { value: "failed", label: "构建失败" },
];

const canManage = (app) => {
  if (!app) return false;
  return authUser.value?.role === "admin" || authUser.value?.id === app.owner.id;
};

const STATUS_DOT = {
  pending: { color: "#d0d0d0", text: "待上传", tagColor: "default" },
  building: { color: "#f59e0b", text: "构建中", tagColor: "processing" },
  running: { color: "#22c55e", text: "运行中", tagColor: "success" },
  stopped: { color: "#9ca3af", text: "已停止", tagColor: "warning" },
  failed: { color: "#ef4444", text: "构建失败", tagColor: "error" },
};

const drawerStatus = computed(() => {
  if (!detailApp.value) return null;
  return STATUS_DOT[detailApp.value.status] || { text: detailApp.value.status, tagColor: "default" };
});

const filteredApps = computed(() => {
  const kw = search.value.trim().toLowerCase();
  return (apps.value || []).filter((a) => {
    if (kw) {
      const inName = a.name?.toLowerCase().includes(kw);
      const inOwner = a.owner?.username?.toLowerCase().includes(kw);
      if (!inName && !inOwner) return false;
    }
    if (statusFilter.value !== "all" && a.status !== statusFilter.value) return false;
    return true;
  });
});

const fetchApps = async () => {
  loading.value = true;
  try {
    const res = await listApps({ page: 1, size: 100 });
    apps.value = res.data.items || [];
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
};

const scrollLogToBottom = () => {
  detailDrawerRef.value?.scrollLogToBottom();
};

const fetchDetail = async () => {
  if (logTimer) {
    clearInterval(logTimer);
    logTimer = null;
  }

  detailLog.value = "";
  runHistory.value = [];

  const app = detailApp.value;
  if (!app) return;

  logLoading.value = true;
  historyLoading.value = true;

  try {
    const logsRes = await getAppLogs(app.id);
    detailLog.value = logsRes.data.log || "";
  } catch {
    detailLog.value = "";
  } finally {
    logLoading.value = false;
    await nextTick();
    scrollLogToBottom();
  }

  if (app.status === "building") {
    logTimer = setInterval(async () => {
      try {
        const res = await getAppLogs(app.id);
        detailLog.value = res.data.log || "";
        await nextTick();
        scrollLogToBottom();
        if (res.data.status !== "building") {
          clearInterval(logTimer);
          logTimer = null;
          fetchApps();
        }
      } catch {
        // ignore
      }
    }, 3000);
  }

  getAppHistory(app.id)
    .then((res) => {
      runHistory.value = res.data || [];
    })
    .catch(() => {})
    .finally(() => {
      historyLoading.value = false;
    });
};

watch(
  () => detailApp.value?.id,
  () => {
    fetchDetail();
  },
);

const handleStop = async (id) => {
  actionLoading.value = id;
  try {
    await stopApp(id);
    message.success("已停止");
    fetchApps();
  } finally {
    actionLoading.value = null;
  }
};

const handleRestart = async (id) => {
  actionLoading.value = id;
  try {
    await restartApp(id);
    message.success("已启动");
    fetchApps();
  } finally {
    actionLoading.value = null;
  }
};

const handleDelete = async (id) => {
  actionLoading.value = id;
  try {
    await deleteApp(id);
    message.success("已删除");
    detailApp.value = null;
    fetchApps();
  } finally {
    actionLoading.value = null;
  }
};

const updateApp = (app) => {
  updateTarget.value = app;
  detailApp.value = null;
};

const onDrawerUpdateApp = () => {
  if (!detailApp.value) return;
  updateTarget.value = detailApp.value;
  detailApp.value = null;
};

const onDrawerStop = (id) => {
  handleStop(id);
  detailApp.value = null;
};

const onDrawerRestart = (id) => {
  handleRestart(id);
  detailApp.value = null;
};

const handleOpenEdit = async (app) => {
  editTarget.value = app;
  editForm.name = app.name;
  editForm.description = app.description || "";
  editForm.owner_id = app.owner.id;

  if (allUsers.value.length === 0) {
    try {
      const res = await client.get("/admin/users");
      allUsers.value = res.data || [];
    } catch {
      // ignore
    }
  }
};

const handleSaveEdit = async () => {
  if (!editTarget.value) return;
  editSaving.value = true;
  try {
    await updateAppInfo(editTarget.value.id, {
      name: editForm.name,
      description: editForm.description,
      owner_id: editForm.owner_id,
    });
    message.success("修改成功");
    editTarget.value = null;
    fetchApps();
  } catch {
    message.error("修改失败");
  } finally {
    editSaving.value = false;
  }
};

const confirmDelete = (app) => {
  Modal.confirm({
    title: "确认删除该应用？",
    content: "删除后无法恢复",
    okText: "删除",
    okButtonProps: { danger: true },
    onOk: () => handleDelete(app.id),
  });
};

const handleUploadSuccess = () => {
  setTimeout(fetchApps, 1000);
};

onMounted(() => {
  loadUser();
  fetchApps();
  pollTimer = setInterval(fetchApps, 10000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (logTimer) clearInterval(logTimer);
});
</script>

<style scoped>
.al-loading {
  text-align: center;
  padding: 80px;
}

.al-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}
</style>
