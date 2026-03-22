<template>
  <template v-if="historyLoading">
    <div class="adp-center"><a-spin /></div>
  </template>

  <template v-else-if="history.length === 0">
    <div class="adp-history-empty">
      <div class="adp-history-empty-icon">📭</div>
      <div class="adp-history-empty-text">暂无运行记录</div>
    </div>
  </template>

  <template v-else>
    <div class="adp-history-list">
      <div v-for="record in history" :key="record.run_id" class="adp-history-card">
        <div class="adp-history-card-head">
          <div class="adp-history-meta">
            <span class="adp-history-time">
              {{ dayjs(record.timestamp).format("YYYY-MM-DD HH:mm:ss") }}
            </span>
            <span v-if="isAdmin" class="adp-tag">
              {{ record.username }}
            </span>
            <span v-if="record.app_version" class="adp-version">v{{ record.app_version }}</span>
          </div>

          <a-button size="small" :loading="downloading === record.run_id" @click="emit('download', record)">
            下载结果
          </a-button>
        </div>

        <div class="adp-history-summary">{{ record.summary }}</div>

        <div class="adp-input-tags">
          <span v-for="([k, v], idx) in Object.entries(record.inputs)" :key="k + '-' + idx" class="adp-tag">
            {{ k }}：{{ String(v) }}
          </span>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import dayjs from "dayjs";

defineProps({
  history: { type: Array, required: true },
  historyLoading: { type: Boolean, required: true },
  isAdmin: { type: Boolean, required: true },
  downloading: { default: null },
});

const emit = defineEmits(["download"]);
</script>

<style scoped>
.adp-center {
  text-align: center;
  padding: 48px;
}

.adp-history-empty {
  text-align: center;
  padding: 48px 20px;
  color: #999;
}

.adp-history-empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.adp-history-empty-text {
  font-size: 14px;
}

.adp-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.adp-history-card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.adp-history-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.adp-history-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

.adp-history-time {
  font-size: 13px;
  color: #1a1a1a;
  font-weight: 500;
}

.adp-version {
  font-size: 12px;
  color: #999;
}

.adp-history-summary {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

.adp-input-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.adp-tag {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
