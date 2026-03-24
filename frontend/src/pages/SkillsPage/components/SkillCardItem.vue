<template>
  <a-card hoverable class="skills-item" @click="$emit('open-detail', skill)">
    <template #title>
      <div class="skills-item-title">
        <span>{{ skill.name }}</span>
        <a-space>
          <a-tag>{{ catLabel(skill.category) }}</a-tag>
          <a-tag>{{ skill.source === "external" ? "外部" : "内部" }}</a-tag>
        </a-space>
      </div>
    </template>
    <p class="skills-item-desc">{{ skill.description || "暂无描述" }}</p>
    <div class="skills-item-meta">{{ skill.author_name || "system" }} · {{ skill.downloads }} 次下载</div>
    <div class="skills-item-actions" @click.stop>
      <a-space>
        <a-button size="small" @click="$emit('toggle-fav', skill)">
          <template #icon><StarOutlined :style="{ color: skill.favorited ? '#faad14' : undefined }" /></template>
        </a-button>
        <a-button size="small" @click="$emit('vote', skill, 'up')">
          <template #icon><LikeOutlined /></template>
        </a-button>
        <a-button size="small" @click="$emit('vote', skill, 'down')">
          <template #icon><DislikeOutlined /></template>
        </a-button>
        <a-button v-if="isAdmin" size="small" @click="$emit('set-pinned', skill, !skill.pinned)">
          <template #icon><PushpinOutlined /></template>
        </a-button>
        <a-button v-if="canEdit(skill)" size="small" @click="$emit('open-edit', skill)">
          <template #icon><EditOutlined /></template>
        </a-button>
        <a-button v-if="canEdit(skill)" size="small" danger @click="$emit('remove', skill)">
          <template #icon><DeleteOutlined /></template>
        </a-button>
        <a-button size="small" @click="$emit('download', skill.name)">
          <template #icon><DownloadOutlined /></template>
        </a-button>
      </a-space>
    </div>
  </a-card>
</template>

<script setup>
import {
  DeleteOutlined,
  DislikeOutlined,
  DownloadOutlined,
  EditOutlined,
  LikeOutlined,
  PushpinOutlined,
  StarOutlined,
} from "@ant-design/icons-vue";

defineProps({
  skill: { type: Object, required: true },
  isAdmin: { type: Boolean, default: false },
  canEdit: { type: Function, required: true },
  catLabel: { type: Function, required: true },
});

defineEmits(["open-detail", "toggle-fav", "vote", "set-pinned", "open-edit", "remove", "download"]);
</script>

<style scoped>
.skills-item-title { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.skills-item-desc { color: #555; margin: 0 0 12px; min-height: 40px; }
.skills-item-meta { font-size: 12px; color: #999; margin-bottom: 10px; }
.skills-item-actions { display: flex; justify-content: flex-end; }
</style>
