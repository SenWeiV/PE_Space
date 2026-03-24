<template>
  <div class="hp-page">
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
      <a-spin size="large" tip="加载中…" />
    </div>

    <div v-else-if="sortedFiltered.length === 0" class="hp-empty">
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

      <HistoryPager v-model:page="page" v-model:page-size="pageSize" :total="sortedFiltered.length" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import dayjs from "dayjs";
import { downloadAppFile, listGroupedRuns } from "@/api/apps";
import { getStoredUser } from "@/utils/authStorage";
import { message } from "ant-design-vue";
import HistoryPageHeader from "./HistoryPageHeader.vue";
import HistoryRecordItem from "./HistoryRecordItem.vue";
import HistoryPager from "./HistoryPager.vue";

const storedUser = getStoredUser();
const isAdmin = computed(() => storedUser?.role === "admin");

const emptyHint = computed(() =>
  isAdmin.value
    ? "记录来自各应用 data/down 目录下的运行产出（results、outputs、history/batch 等带批次时间戳的文件）。请确认应用已运行并写入文件；最多展示 200 条批次。"
    : "仅显示您负责的应用。请在应用的 down 目录中产生运行产出文件，否则列表为空。",
);

const groups = ref([]);
const loading = ref(true);
const downloading = ref(null);

const page = ref(1);
const pageSize = ref(15);

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

const sortedFiltered = computed(() => {
  const list = [...filtered.value];
  list.sort((a, b) => {
    const ta = a.timestamp ? dayjs(a.timestamp).valueOf() : 0;
    const tb = b.timestamp ? dayjs(b.timestamp).valueOf() : 0;
    return tb - ta;
  });
  return list;
});

watch([dateRange, userKeyword, appKeyword], () => {
  page.value = 1;
});

const paged = computed(() => {
  const total = sortedFiltered.value.length;
  const size = pageSize.value;
  const totalPages = Math.ceil(total / size) || 1;
  const curPage = Math.max(1, Math.min(page.value, totalPages));
  const start = (curPage - 1) * size;
  return sortedFiltered.value.slice(start, start + size);
});

const hasFilter = computed(() => !!(dateRange.value || userKeyword.value || appKeyword.value));

const metaCountText = computed(() => {
  const all = groups.value.length;
  const fil = sortedFiltered.value.length;
  if (hasFilter.value) return `共 ${fil} 条（筛选自 ${all} 条）`;
  return `共 ${fil} 条`;
});

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
</script>

<style scoped>
.hp-page {
  min-height: 40vh;
}

.hp-spacer {
  height: 16px;
}

.hp-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
  padding: 40px 16px;
}

.hp-empty {
  text-align: center;
  padding: 48px 16px 64px;
}

.hp-empty-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: 10px;
}

.hp-empty-text {
  font-size: 15px;
  font-weight: 500;
  color: #595959;
}

.hp-empty-hint {
  max-width: 520px;
  margin: 10px auto 0;
  padding: 0 16px;
  font-size: 13px;
  line-height: 1.55;
  color: #8c8c8c;
}

.hp-empty-clear {
  margin-top: 14px;
  padding: 6px 16px;
  font-size: 13px;
  color: #1677ff;
  background: #fff;
  border: 1px solid #91caff;
  border-radius: 6px;
  cursor: pointer;
}

.hp-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}
</style>
