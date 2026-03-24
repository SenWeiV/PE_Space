<template>
  <div class="hp-sticky">
    <h1 class="hp-title">历史记录</h1>
    <p class="hp-sub">每次运行的所有产出文件汇总在一条记录中</p>

    <div class="hp-filters">
      <a-range-picker
        :value="dateRange"
        class="hp-picker"
        :allow-clear="true"
        :placeholder="['开始日期', '结束日期']"
        @change="onDateRangeChange"
      />

      <a-auto-complete
        :value="userKeyword"
        class="hp-autocomplete"
        :options="userOptions"
        :allow-clear="true"
        placeholder="搜索用户"
        @update:value="emit('update:userKeyword', $event)"
        @select="onUserSelect"
        @clear="emit('update:userKeyword', '')"
      >
        <template #prefix>
          <UserOutlined class="hp-input-icon" />
        </template>
      </a-auto-complete>

      <a-auto-complete
        :value="appKeyword"
        class="hp-autocomplete hp-autocomplete-wide"
        :options="appOptions"
        :allow-clear="true"
        placeholder="搜索工具"
        @update:value="emit('update:appKeyword', $event)"
        @select="onAppSelect"
        @clear="emit('update:appKeyword', '')"
      >
        <template #prefix>
          <SearchOutlined class="hp-input-icon" />
        </template>
      </a-auto-complete>

      <button v-if="hasFilter" type="button" class="hp-clear-btn" @click="emit('clearFilters')">清除筛选</button>

      <span v-if="!loading" class="hp-meta-count">{{ metaCountText }}</span>
    </div>
  </div>
</template>

<script setup>
import { SearchOutlined, UserOutlined } from "@ant-design/icons-vue";

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
  padding: 24px 0 20px;
  border-bottom: 1px solid #f0f0f0;
}

.hp-title {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 6px;
}

.hp-sub {
  font-size: 13px;
  color: #8c8c8c;
  margin: 0 0 18px;
}

.hp-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.hp-picker {
  width: 280px;
  max-width: 100%;
}

.hp-autocomplete {
  width: 200px;
  max-width: 100%;
}

.hp-autocomplete-wide {
  width: 220px;
}

.hp-input-icon {
  color: #bfbfbf;
}

.hp-clear-btn {
  padding: 4px 12px;
  font-size: 13px;
  color: #595959;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
}

.hp-clear-btn:hover {
  color: #1677ff;
  border-color: #1677ff;
}

.hp-meta-count {
  font-size: 13px;
  color: #8c8c8c;
  margin-left: auto;
}
</style>
