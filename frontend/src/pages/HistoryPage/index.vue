<template>
  <div>
    <HistoryPageHeader
      :date-range="dateRange"
      v-model:user-keyword="userKeyword"
      v-model:app-keyword="appKeyword"
      :user-options="userOptions"
      :app-options="appOptions"
      :has-filter="hasFilter"
      :loading="loading"
      :meta-count-text="metaCountText"
      @update:date-range="dateRange = $event"
      @clear-filters="clearFilters"
    />

    <div class="hp-spacer" />

    <div v-if="loading" class="hp-loading">
      <a-spin />
    </div>

    <div v-else-if="filtered.length === 0" class="hp-empty">
      <div class="hp-empty-icon">{{ hasFilter ? "🔍" : "📭" }}</div>
      <div class="hp-empty-text">{{ hasFilter ? "没有匹配的记录" : "暂无运行记录" }}</div>
      <p v-if="!hasFilter" class="hp-empty-hint">{{ emptyHint }}</p>
      <button v-if="hasFilter" type="button" class="hp-empty-clear" @click="clearFilters">清除筛选</button>
    </div>

    <div v-else class="hp-list">
      <HistoryRecordItem
        v-for="record in paged"
        :key="record.app_id + '_' + record.ts_key"
        :record="record"
        :downloading-key="downloading"
        @download="(file) => handleDownload(record.app_id, file)"
      />

      <HistoryPager v-model:page="page" :total-pages="totalPages" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import dayjs from "dayjs";
import { downloadAppFile, listGroupedRuns } from "@/api/apps";
import { getStoredUser } from "@/utils/authStorage";
import { message } from "ant-design-vue";
import HistoryPageHeader from "./HistoryPageHeader.vue";
import HistoryRecordItem from "./HistoryRecordItem.vue";
import HistoryPager from "./HistoryPager.vue";

const storedUser = getStoredUser();

const emptyHint =
  storedUser?.role === "admin"
    ? "记录来自服务端各应用数据目录下的运行产出（如 data/results、data/outputs、data/history/batch 中带时间戳的文件）。请确认 UPLOAD_DIR 指向真实路径且应用已产生过文件。"
    : "仅显示您作为负责人的应用；且服务端需在对应应用的 data 目录中存在上述运行产出文件，否则列表为空。";

const groups = ref([]);
const loading = ref(true);
const downloading = ref(null);

const page = ref(1);
const pageSize = 15;

const dateRange = ref(null);
const userKeyword = ref("");
const appKeyword = ref("");

const fetchGroups = async () => {
  loading.value = true;
  try {
    const res = await listGroupedRuns();
    groups.value = res.data.groups || [];
  } catch {
    message.error("加载失败");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchGroups();
});

const allUsernames = computed(() => {
  const set = new Set();
  (groups.value || []).forEach((r) => {
    if (r.username) set.add(r.username);
  });
  return Array.from(set).sort();
});

const allAppNames = computed(() => {
  const set = new Set();
  (groups.value || []).forEach((r) => {
    if (r.app_name) set.add(r.app_name);
  });
  return Array.from(set).sort();
});

const userOptions = computed(() => {
  if (!userKeyword.value.trim()) return allUsernames.value.map((v) => ({ value: v }));
  const kw = userKeyword.value.trim().toLowerCase();
  return allUsernames.value.filter((name) => name.toLowerCase().includes(kw)).map((v) => ({ value: v }));
});

const appOptions = computed(() => {
  if (!appKeyword.value.trim()) return allAppNames.value.map((v) => ({ value: v }));
  const kw = appKeyword.value.trim().toLowerCase();
  return allAppNames.value.filter((name) => name.toLowerCase().includes(kw)).map((v) => ({ value: v }));
});

const filtered = computed(() => {
  let list = groups.value || [];

  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    const start = dateRange.value[0].startOf("day");
    const end = dateRange.value[1].endOf("day");
    list = list.filter((r) => {
      if (!r.timestamp) return false;
      const t = dayjs(r.timestamp);
      // 含首尾两天全天（原先 isAfter/isBefore 会漏掉边界时刻）
      return !t.isBefore(start) && !t.isAfter(end);
    });
  }

  if (userKeyword.value.trim()) {
    const kw = userKeyword.value.trim().toLowerCase();
    list = list.filter((r) => r.username?.toLowerCase().includes(kw));
  }

  if (appKeyword.value.trim()) {
    const kw = appKeyword.value.trim().toLowerCase();
    list = list.filter((r) => r.app_name?.toLowerCase().includes(kw));
  }

  return list;
});

watch([dateRange, userKeyword, appKeyword], () => {
  page.value = 1;
});

const paged = computed(() => {
  const total = filtered.value.length;
  const totalPages = Math.ceil(total / pageSize);
  const curPage = Math.max(1, Math.min(page.value, totalPages || 1));
  const start = (curPage - 1) * pageSize;
  return filtered.value.slice(start, start + pageSize);
});

const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize));

const hasFilter = computed(() => !!(dateRange.value || userKeyword.value || appKeyword.value));

const metaCountText = computed(() =>
  hasFilter.value ? `${filtered.value.length} / ${groups.value.length} 条` : `共 ${groups.value.length} 条`,
);

const clearFilters = () => {
  dateRange.value = null;
  userKeyword.value = "";
  appKeyword.value = "";
};

const handleDownload = async (appId, file) => {
  const key = `${appId}/${file.path}`;
  downloading.value = key;
  try {
    await downloadAppFile(appId, file.path, file.name);
  } catch {
    message.error("文件不存在或已删除");
  } finally {
    downloading.value = null;
  }
};

onBeforeUnmount(() => {});
</script>

<style scoped>
.hp-empty-hint {
  max-width: 520px;
  margin: 12px auto 0;
  padding: 0 16px;
  font-size: 13px;
  line-height: 1.55;
  color: #888;
  text-align: center;
}
</style>
