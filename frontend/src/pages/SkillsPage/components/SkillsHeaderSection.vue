<template>
  <div>
    <div class="skills-header">
      <div>
        <h1>Skills 市场</h1>
        <p>团队共享的 AI Skills，下载后放入 Agent 的 skills 目录即可使用</p>
      </div>
      <a-space>
        <a-button @click="$emit('open-guide')">
          <template #icon><QuestionCircleOutlined /></template>
          指南
        </a-button>
        <a-button v-if="isAdmin" @click="$emit('toggle-stats')">
          <template #icon><BarChartOutlined /></template>
          统计
        </a-button>
        <a-button type="primary" class="skills-primary-btn" @click="$emit('open-create')">
          <template #icon><PlusOutlined /></template>
          发布 Skill
        </a-button>
      </a-space>
    </div>

    <a-alert v-if="!bannerDismissed" type="info" show-icon class="skills-banner">
      <template #message>首次使用？让 Agent 学会操作 Skills 市场</template>
      <template #description>
        <div class="skills-banner-desc">
          下载引导 Skill 放入 Agent 的 skills 目录（openclaw / Claude Code），之后可直接让 Agent 帮你搜索和安装 Skills。
        </div>
      </template>
      <template #action>
        <a-space>
          <a-button type="primary" class="skills-primary-btn" size="small" @click="$emit('download-bootstrap')">
            一键下载
          </a-button>
          <a-button size="small" @click="$emit('dismiss-banner')">关闭</a-button>
        </a-space>
      </template>
    </a-alert>

    <a-card v-if="isAdmin && statsOpen && stats" size="small" class="skills-stats">
      <a-space size="large">
        <div class="skills-stat"><b>{{ stats.total_skills }}</b><span>Skills</span></div>
        <div class="skills-stat"><b>{{ stats.total_downloads }}</b><span>下载量</span></div>
      </a-space>
    </a-card>

    <div class="skills-filter">
      <a-input :value="searchQ" allow-clear placeholder="搜索名称或描述" class="skills-search" @update:value="$emit('update:searchQ', $event)">
        <template #prefix><SearchOutlined /></template>
      </a-input>
      <a-select :value="filterCat" :options="categories" class="skills-select" @update:value="$emit('update:filterCat', $event)" />
      <a-select :value="sortBy" :options="sortOptions" class="skills-select" @update:value="$emit('update:sortBy', $event)" />
      <a-button :type="favOnly ? 'primary' : 'default'" @click="$emit('update:favOnly', !favOnly)">
        <template #icon><StarOutlined /></template>
        收藏
      </a-button>
    </div>
  </div>
</template>

<script setup>
import {
  BarChartOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StarOutlined,
} from "@ant-design/icons-vue";

defineProps({
  isAdmin: { type: Boolean, default: false },
  statsOpen: { type: Boolean, default: false },
  stats: { type: Object, default: null },
  bannerDismissed: { type: Boolean, default: false },
  categories: { type: Array, default: () => [] },
  sortOptions: { type: Array, default: () => [] },
  favOnly: { type: Boolean, default: false },
  searchQ: { type: String, default: "" },
  filterCat: { type: String, default: "" },
  sortBy: { type: String, default: "default" },
});

defineEmits([
  "open-guide",
  "toggle-stats",
  "open-create",
  "download-bootstrap",
  "dismiss-banner",
  "update:searchQ",
  "update:filterCat",
  "update:sortBy",
  "update:favOnly",
]);
</script>

<style scoped>
.skills-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.skills-header h1 { margin: 0; font-size: 28px; }
.skills-header p { margin: 6px 0 0; color: #666; font-size: 13px; }
.skills-primary-btn.ant-btn-primary { background: #000 !important; border-color: #000 !important; }
.skills-banner { margin-bottom: 16px; }
.skills-banner-desc { font-size: 13px; color: #666; }
.skills-stats { margin-bottom: 16px; }
.skills-stat { display: flex; flex-direction: column; align-items: center; }
.skills-stat b { font-size: 24px; }
.skills-stat span { color: #999; font-size: 12px; }
.skills-filter { display: flex; gap: 8px; margin-bottom: 16px; }
.skills-search { width: 280px; }
.skills-select { width: 140px; }
</style>
