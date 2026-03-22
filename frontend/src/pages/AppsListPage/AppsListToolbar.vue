<template>
  <div class="al-toolbar">
    <a-input-search
      :value="search"
      class="al-search"
      placeholder="搜索应用名或创建者..."
      :allow-clear="true"
      @update:value="emit('update:search', $event)"
    />

    <a-select :value="statusFilter" class="al-select" :options="statusOptions" @update:value="emit('update:statusFilter', $event)" />

    <span v-if="showFilterHint" class="al-filter-hint">
      {{ filteredCount }} / {{ totalCount }} 个应用
    </span>
  </div>
</template>

<script setup>
defineProps({
  search: { type: String, required: true },
  statusFilter: { type: String, required: true },
  statusOptions: { type: Array, required: true },
  showFilterHint: { type: Boolean, required: true },
  filteredCount: { type: Number, required: true },
  totalCount: { type: Number, required: true },
});

const emit = defineEmits(["update:search", "update:statusFilter"]);
</script>

<style scoped>
.al-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.al-search {
  width: 240px;
}

.al-select {
  width: 140px;
}

.al-filter-hint {
  font-size: 13px;
  color: #999;
}
</style>
