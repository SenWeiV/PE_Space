<template>
  <div class="hp-record">
    <div class="hp-record-meta" :class="{ 'hp-record-meta--mb': visibleFiles.length > 0 }">
      <span class="hp-time">
        <ClockCircleOutlined class="hp-time-icon" />
        {{ record.timestamp ? dayjs(record.timestamp).format("YYYY-MM-DD HH:mm") : "-" }}
      </span>

      <span class="hp-app-pill">
        <AppstoreOutlined class="hp-app-pill-icon" />
        {{ record.app_name }}
      </span>

      <span v-if="record.username" class="hp-user-pill">
        <UserOutlined class="hp-user-pill-icon" />
        {{ record.username }}
      </span>

      <span class="hp-file-count">{{ visibleFiles.length }} 个文件</span>
    </div>

    <div v-if="visibleFiles.length > 0" class="hp-files">
      <div v-for="file in visibleFiles" :key="file.path" class="hp-file-row">
        <a-tag class="hp-file-tag" :color="CATEGORY_STYLE[file.category]?.color || CATEGORY_STYLE.output.color">
          {{ CATEGORY_STYLE[file.category]?.label || CATEGORY_STYLE.output.label }}
        </a-tag>

        <span class="hp-file-name">
          <FileIcon :name="file.name" />
          {{ file.name }}
        </span>

        <span class="hp-file-size">{{ formatSize(file.size) }}</span>

        <a-button
          class="hp-download"
          size="small"
          type="text"
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
import FileIcon from "@/components/FileIcon.vue";
import { AppstoreOutlined, ClockCircleOutlined, DownloadOutlined, UserOutlined } from "@ant-design/icons-vue";
import { CATEGORY_STYLE, formatSize, getVisibleFiles } from "./historyUtils";
import { computed } from "vue";

const props = defineProps({
  record: { type: Object, required: true },
  downloadingKey: { type: String, default: null },
});

const emit = defineEmits(["download"]);

const visibleFiles = computed(() => getVisibleFiles(props.record));
</script>

<style scoped>
.hp-record {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 16px 20px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.hp-record:hover {
  border-color: #d0d0d0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.hp-record-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.hp-record-meta--mb {
  margin-bottom: 12px;
}

.hp-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #888;
}

.hp-time-icon {
  font-size: 12px;
}

.hp-app-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  background: #f5f5f5;
  padding: 2px 10px;
  border-radius: 6px;
}

.hp-app-pill-icon {
  font-size: 11px;
  color: #999;
}

.hp-user-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  background: #f0f7ff;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #e0edff;
}

.hp-user-pill-icon {
  font-size: 10px;
}

.hp-file-count {
  font-size: 12px;
  color: #bbb;
  margin-left: auto;
}

.hp-files {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #fafafa;
  border-radius: 8px;
  padding: 10px 12px;
}

.hp-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.hp-file-tag {
  margin: 0;
  font-size: 11px;
  line-height: 18px;
  flex-shrink: 0;
}

.hp-file-name {
  font-size: 13px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.hp-file-size {
  font-size: 11px;
  color: #aaa;
  white-space: nowrap;
  flex-shrink: 0;
}

.hp-download {
  color: #1677ff;
  padding: 0 6px;
  flex-shrink: 0;
}
</style>
