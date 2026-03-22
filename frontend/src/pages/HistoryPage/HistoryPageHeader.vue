<template>
  <div class="hp-sticky">
    <h1 class="hp-title">历史记录</h1>
    <p class="hp-sub">每次运行的所有产出文件汇总在一条记录中</p>

    <div class="hp-filters">
      <FilterOutlined class="hp-filter-icon" />

      <a-range-picker
        :value="dateRange"
        class="hp-w-260"
        :allow-clear="true"
        :placeholder="['开始日期', '结束日期']"
        @change="onDateRangeChange"
      />

      <a-auto-complete
        :value="userKeyword"
        class="hp-w-170"
        :data-source="userOptions"
        @update:value="emit('update:userKeyword', $event)"
        @select="onUserSelect"
      >
        <template #default>
          <a-input
            :value="userKeyword"
            placeholder="搜索用户"
            :allow-clear="true"
            @update:value="emit('update:userKeyword', $event)"
          />
        </template>
      </a-auto-complete>

      <a-auto-complete
        :value="appKeyword"
        class="hp-w-170"
        :data-source="appOptions"
        @update:value="emit('update:appKeyword', $event)"
        @select="onAppSelect"
      >
        <template #default>
          <a-input
            :value="appKeyword"
            placeholder="搜索工具"
            :allow-clear="true"
            @update:value="emit('update:appKeyword', $event)"
          />
        </template>
      </a-auto-complete>

      <button v-if="hasFilter" type="button" class="hp-clear-btn" @click="emit('clearFilters')">清除筛选</button>

      <span v-if="!loading" class="hp-meta-count">
        {{ metaCountText }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { FilterOutlined } from "@ant-design/icons-vue";

defineProps({
  dateRange: { type: Array, default: null },
  userKeyword: { type: String, required: true },
  appKeyword: { type: String, required: true },
  userOptions: { type: Array, required: true },
  appOptions: { type: Array, required: true },
  hasFilter: { type: Boolean, required: true },
  loading: { type: Boolean, required: true },
  metaCountText: { type: String, required: true },
});

const emit = defineEmits(["update:userKeyword", "update:appKeyword", "update:dateRange", "clearFilters"]);

const onDateRangeChange = (vals) => {
  if (!vals || vals.length < 2) {
    emit("update:dateRange", null);
    return;
  }
  const [start, end] = vals;
  if (!start || !end) emit("update:dateRange", null);
  else emit("update:dateRange", [start, end]);
};

const onUserSelect = (val) => {
  emit("update:userKeyword", val);
};

const onAppSelect = (val) => {
  emit("update:appKeyword", val);
};
</script>

<style scoped>
.hp-sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.hp-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 4px;
}

.hp-sub {
  font-size: 14px;
  color: #888;
  margin: 0 0 16px;
}

.hp-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.hp-filter-icon {
  font-size: 13px;
  color: #999;
}

.hp-w-260 {
  width: 260px;
}

.hp-w-170 {
  width: 170px;
}

.hp-clear-btn {
  padding: 2px 10px;
  font-size: 12px;
  color: #999;
  background: none;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
}

.hp-meta-count {
  font-size: 12px;
  color: #bbb;
  margin-left: auto;
}
</style>
