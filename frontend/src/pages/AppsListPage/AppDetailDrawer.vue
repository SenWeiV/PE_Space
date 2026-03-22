<template>
  <a-drawer :open="open" :title="app?.name" width="520" @close="emit('close')">
    <template #extra>
      <a-tag v-if="drawerStatus" :color="drawerStatus.tagColor">
        {{ drawerStatus.text }}
      </a-tag>
    </template>

    <div v-if="app">
      <div class="al-detail-rows">
        <div class="al-detail-row">
          <span class="al-detail-label">创建者</span>
          <span class="al-detail-value">{{ app.owner.username }}</span>
        </div>
        <div class="al-detail-row">
          <span class="al-detail-label">创建时间</span>
          <span>{{ dayjs(app.created_at).format("YYYY-MM-DD HH:mm") }}</span>
        </div>
        <div class="al-detail-row">
          <span class="al-detail-label">更新时间</span>
          <span>{{ dayjs(app.updated_at).format("YYYY-MM-DD HH:mm") }}</span>
        </div>

        <div v-if="app.status === 'running' && app.access_url" class="al-detail-row">
          <span class="al-detail-label">访问地址</span>
          <a v-if="runningHref" :href="runningHref" target="_blank" rel="noreferrer">
            {{ runningLabel || runningHref }}
          </a>
          <span v-else class="al-detail-value">缺少映射端口，请刷新列表后重试</span>
        </div>
      </div>

      <div class="al-section">
        <div class="al-section-title">应用说明</div>
        <div v-if="app.description" class="al-desc">
          <MarkdownView :content="app.description" />
        </div>
        <div v-else class="al-desc-empty">暂无说明（上传包含 README.md 的 zip 后自动读取）</div>
      </div>

      <div class="al-section al-section--spaced">
        <div class="al-section-head">
          <span class="al-section-title">使用记录</span>
          <span v-if="runHistory.length > 0" class="al-section-count">共 {{ runHistory.length }} 条</span>
        </div>

        <div v-if="historyLoading" class="al-spin-sm">
          <a-spin size="small" />
        </div>

        <div v-else-if="runHistory.length === 0" class="al-history-empty">暂无使用记录</div>

        <div v-else class="al-history-list">
          <div v-for="(r, idx) in runHistory" :key="r.run_id || idx" class="al-history-item">
            <div class="al-history-head" :class="{ 'al-history-head--mb': !!r.summary }">
              <span class="al-history-user">{{ r.username }}</span>
              <span class="al-history-time">{{ dayjs(r.timestamp).format("MM-DD HH:mm") }}</span>
            </div>
            <div v-if="r.summary" class="al-history-summary">{{ r.summary }}</div>
          </div>
        </div>
      </div>

      <div class="al-section al-section--spaced">
        <div class="al-log-head">
          <span class="al-section-title">构建日志</span>
          <span v-if="app.status === 'building'" class="al-building-badge">构建中…</span>
        </div>

        <div v-if="logLoading" class="al-spin-md">
          <a-spin size="small" />
        </div>

        <pre v-else ref="logPreRef" class="al-log-pre">
          {{ detailLog || "暂无日志" }}
        </pre>
      </div>

      <div v-if="canManage" class="al-drawer-actions">
        <button type="button" class="al-act al-act--update" @click="emit('updateApp')">更新应用</button>

        <button v-if="app.status === 'running'" type="button" class="al-act al-act--stop" @click="emit('stop', app.id)">
          停止
        </button>

        <button v-if="app.status === 'stopped'" type="button" class="al-act al-act--start" @click="emit('restart', app.id)">
          启动
        </button>

        <button type="button" class="al-act al-act--delete" @click="emit('delete', app)">删除应用</button>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { computed, ref } from "vue";
import dayjs from "dayjs";
import MarkdownView from "@/components/MarkdownView.vue";
import { buildRunningAppUrl, runningAppDisplayUrl } from "@/utils/runningAppUrl";

const props = defineProps({
  open: { type: Boolean, required: true },
  app: { type: Object, default: null },
  drawerStatus: { type: Object, default: null },
  username: { type: String, required: true },
  runHistory: { type: Array, required: true },
  historyLoading: { type: Boolean, required: true },
  detailLog: { type: String, required: true },
  logLoading: { type: Boolean, required: true },
  canManage: { type: Boolean, required: true },
});

const runningHref = computed(() =>
  props.app ? buildRunningAppUrl(props.app, props.username) : "",
);
const runningLabel = computed(() =>
  props.app ? runningAppDisplayUrl(props.app) : "",
);

const emit = defineEmits(["close", "updateApp", "stop", "restart", "delete"]);

const logPreRef = ref(null);

const scrollLogToBottom = () => {
  const el = logPreRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
};

defineExpose({ scrollLogToBottom });
</script>

<style scoped>
.al-detail-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.al-detail-row {
  display: flex;
  gap: 12px;
}

.al-detail-label {
  color: #999;
  width: 64px;
  flex-shrink: 0;
}

.al-detail-value {
  font-weight: 500;
}

.al-section {
  border-top: 1px solid #f0f0f0;
  padding-top: 20px;
}

.al-section--spaced {
  margin-top: 20px;
}

.al-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12px;
}

.al-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.al-section-head .al-section-title {
  margin-bottom: 0;
}

.al-section-count {
  font-size: 11px;
  color: #999;
}

.al-desc {
  font-size: 14px;
  color: #333;
  line-height: 1.8;
}

.al-desc-empty {
  color: #999;
  font-size: 13px;
}

.al-spin-sm {
  text-align: center;
  padding: 16px;
}

.al-history-empty {
  color: #bbb;
  font-size: 13px;
  text-align: center;
  padding: 12px 0;
}

.al-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.al-history-item {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid #f0f0f0;
}

.al-history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.al-history-head--mb {
  margin-bottom: 4px;
}

.al-history-user {
  font-size: 12px;
  color: #1a1a1a;
  font-weight: 500;
}

.al-history-time {
  font-size: 11px;
  color: #bbb;
}

.al-history-summary {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.al-log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.al-log-head .al-section-title {
  margin-bottom: 0;
}

.al-building-badge {
  font-size: 11px;
  color: #f59e0b;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  padding: 1px 6px;
}

.al-spin-md {
  text-align: center;
  padding: 20px;
}

.al-log-pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.al-drawer-actions {
  border-top: 1px solid #f0f0f0;
  padding-top: 20px;
  margin-top: 20px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.al-act {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  border: none;
}

.al-act--update {
  background: #f0f7ff;
  color: #165dff;
  border: 1px solid #bfdbfe;
}

.al-act--stop {
  background: #f0f0f0;
  color: #666;
}

.al-act--start {
  background: #2c2c2c;
  color: #fff;
}

.al-act--delete {
  background: #fff1f0;
  color: #ef4444;
  border: 1px solid #fecaca;
}
</style>
