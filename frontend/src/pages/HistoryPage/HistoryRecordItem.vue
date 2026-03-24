<template>
  <div class="hp-card">
    <div class="hp-card-head">
      <div class="hp-head-left">
        <span class="hp-time">
          <ClockCircleOutlined class="hp-clock" />
          {{ timeLabel }}
        </span>
        <span
          class="hp-tag-action"
          :style="{
            color: actionStyle.color,
            background: actionStyle.bg,
            borderColor: actionStyle.border,
          }"
        >
          {{ record.summary_type || "其他" }}
        </span>
        <span class="hp-tag-tool">{{ record.app_name }}</span>
        <span v-if="record.username" class="hp-tag-user">{{ record.username }}</span>
      </div>
      <span v-if="visibleFiles.length > 0" class="hp-file-count">{{ visibleFiles.length }}个文件</span>
    </div>

    <p v-if="record.request_path && showRequestPath" class="hp-line-path">
      <span class="hp-method">{{ record.request_method }}</span>
      {{ record.request_path }}
    </p>

    <div v-if="visibleFiles.length > 0" class="hp-file-list">
      <div v-for="file in visibleFiles" :key="file.path" class="hp-file-line">
        <a-tag class="hp-cat" :color="CATEGORY_STYLE[file.category]?.color || CATEGORY_STYLE.output.color">
          {{ CATEGORY_STYLE[file.category]?.label || CATEGORY_STYLE.output.label }}
        </a-tag>
        <span class="hp-fname">
          <FileIcon :name="file.name" />
          <span class="hp-fname-text">{{ file.name }}</span>
        </span>
        <span class="hp-fsize">{{ formatSize(file.size) }}</span>
        <a-button
          type="text"
          size="small"
          class="hp-dl"
          :loading="downloadingKey === `${record.app_id}/${file.path}`"
          @click="emit('download', file)"
        >
          <template #icon>
            <DownloadOutlined />
          </template>
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import dayjs from "dayjs";
import { computed } from "vue";
import FileIcon from "@/components/FileIcon.vue";
import { ClockCircleOutlined, DownloadOutlined } from "@ant-design/icons-vue";
import { CATEGORY_STYLE, SUMMARY_TYPE_STYLE, formatSize, getVisibleFiles } from "./historyUtils";

const props = defineProps({
  record: { type: Object, required: true },
  downloadingKey: { type: String, default: null },
});

const emit = defineEmits(["download"]);

const visibleFiles = computed(() => getVisibleFiles(props.record));

const timeLabel = computed(() =>
  props.record.timestamp ? dayjs(props.record.timestamp).format("YYYY-MM-DD HH:mm:ss") : "-",
);

const actionStyle = computed(() => {
  const type = props.record.summary_type || "其他";
  return SUMMARY_TYPE_STYLE[type] || SUMMARY_TYPE_STYLE["其他"];
});

/** 是否显示请求路径（访问和下载类型显示） */
const showRequestPath = computed(() => {
  const code = props.record.summary_code;
  return code === 1 || code === 2;
});
</script>

<style scoped>
.hp-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 16px 18px;
}

.hp-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.hp-head-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.hp-time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #262626;
  font-weight: 500;
}

.hp-clock {
  color: #8c8c8c;
  font-size: 14px;
}

.hp-tag-tool {
  display: inline-block;
  font-size: 13px;
  color: #262626;
  background: #f5f5f5;
  border: 1px solid #f0f0f0;
  padding: 2px 10px;
  border-radius: 4px;
}

.hp-tag-action {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
}

.hp-line-path {
  font-size: 12px;
  color: #8c8c8c;
  margin: 0 0 8px;
  line-height: 1.5;
  word-break: break-all;
}

.hp-method {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
}

.hp-tag-user {
  display: inline-block;
  font-size: 13px;
  color: #1677ff;
  background: #e6f4ff;
  border: 1px solid #91caff;
  padding: 2px 10px;
  border-radius: 4px;
}

.hp-file-count {
  font-size: 13px;
  color: #8c8c8c;
  flex-shrink: 0;
}

.hp-line-summary,
.hp-line-inputs {
  font-size: 12px;
  color: #595959;
  margin: 0 0 8px;
  line-height: 1.5;
}

.hp-file-list {
  background: #fafafa;
  border-radius: 4px;
  padding: 8px 12px;
}

.hp-file-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.hp-file-line:last-child {
  border-bottom: none;
}

.hp-cat {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  flex-shrink: 0;
}

.hp-fname {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: #262626;
}

.hp-fname-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hp-fsize {
  font-size: 12px;
  color: #8c8c8c;
  flex-shrink: 0;
  min-width: 56px;
  text-align: right;
}

.hp-dl {
  color: #1677ff;
  flex-shrink: 0;
}
</style>
