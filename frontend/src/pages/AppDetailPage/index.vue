<template>
  <div>
    <AppDetailToolbar v-if="!loading" :app="app" :access-url="accessUrl" @stop="handleStop" @restart="handleRestart" @delete="handleDelete" />

    <div v-if="loading" class="adp-center">
      <a-spin />
    </div>

    <div v-else-if="!app" class="adp-missing">App 不存在</div>

    <div v-else>
      <a-tabs>
        <a-tab-pane key="info" tab="基本信息">
          <AppDetailInfoTab :app="app" :status-info="s" />
        </a-tab-pane>

        <a-tab-pane key="log" tab="构建日志">
          <AppDetailLogTab ref="logTabRef" :log="log" />
        </a-tab-pane>

        <a-tab-pane key="history" tab="运行历史">
          <AppDetailHistoryTab
            :history="history"
            :history-loading="historyLoading"
            :is-admin="isAdmin"
            :downloading="downloading"
            @download="handleDownload"
          />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  deleteApp,
  downloadOutput,
  getApp,
  getAppHistory,
  getAppLogs,
  restartApp,
  stopApp,
} from "@/api/apps";
import { message } from "ant-design-vue";
import { getStoredUser } from "@/utils/authStorage";
import AppDetailToolbar from "./AppDetailToolbar.vue";
import AppDetailInfoTab from "./AppDetailInfoTab.vue";
import AppDetailLogTab from "./AppDetailLogTab.vue";
import AppDetailHistoryTab from "./AppDetailHistoryTab.vue";
import { buildRunningAppUrl } from "@/utils/runningAppUrl";

const route = useRoute();
const router = useRouter();

const appId = computed(() => {
  const raw = route.params.appId;
  if (raw === undefined || raw === null || !/^\d+$/.test(String(raw).trim())) {
    return NaN;
  }
  return Number(raw);
});

const STATUS_MAP = {
  pending: { status: "default", text: "待上传" },
  building: { status: "processing", text: "构建中" },
  running: { status: "success", text: "运行中" },
  stopped: { status: "warning", text: "已停止" },
  failed: { status: "error", text: "构建失败" },
};

const app = ref(null);
const log = ref("");
const loading = ref(true);
const history = ref([]);
const historyLoading = ref(false);
const downloading = ref(null);
const logTabRef = ref(null);

const authUser = ref(null);
const loadUser = () => {
  authUser.value = getStoredUser();
};

const isAdmin = computed(() => authUser.value?.role === "admin");
const username = computed(() => authUser.value?.username || "");

const s = computed(() => STATUS_MAP[app.value?.status] || { status: "default", text: app.value?.status || "" });

const accessUrl = computed(() => {
  if (!app.value?.access_url) return undefined;
  const u = buildRunningAppUrl(app.value, username.value);
  return u || undefined;
});

const fetchApp = async () => {
  const res = await getApp(appId.value);
  app.value = res.data;
};

const fetchLog = async () => {
  const res = await getAppLogs(appId.value);
  log.value = res.data.log || "";
  logTabRef.value?.scrollToEnd();
};

const fetchHistory = async () => {
  historyLoading.value = true;
  try {
    const res = await getAppHistory(appId.value);
    history.value = res.data || [];
  } finally {
    historyLoading.value = false;
  }
};

let timer = null;

const init = async () => {
  if (!Number.isFinite(appId.value) || appId.value <= 0) {
    loading.value = false;
    router.replace("/apps");
    return;
  }
  loading.value = true;
  await Promise.all([fetchApp(), fetchLog(), fetchHistory()]).finally(() => {});

  timer = setInterval(async () => {
    const res = await getApp(appId.value);
    app.value = res.data;
    if (res.data.status === "building") {
      await fetchLog();
    } else {
      clearInterval(timer);
      timer = null;
    }
  }, 3000);

  loading.value = false;
};

const handleStop = async () => {
  await stopApp(appId.value);
  message.success("已停止");
  await fetchApp();
};

const handleRestart = async () => {
  await restartApp(appId.value);
  message.success("已重启");
  await fetchApp();
};

const handleDelete = async () => {
  await deleteApp(appId.value);
  message.success("已删除");
  router.push("/apps");
};

const handleDownload = async (record) => {
  downloading.value = record.run_id;
  try {
    await downloadOutput(appId.value, record.run_id, record.output_filename);
  } catch {
    message.error("文件不存在或已删除");
  } finally {
    downloading.value = null;
  }
};

watch(
  () => route.params.appId,
  async () => {
    if (timer) clearInterval(timer);
    timer = null;
    await init();
  },
);

onMounted(() => {
  loadUser();
  init();
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.adp-center {
  text-align: center;
  padding: 48px;
}

.adp-missing {
  color: #666;
  padding: 24px;
}
</style>
