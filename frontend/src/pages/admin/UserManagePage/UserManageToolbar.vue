<template>
  <div class="um-toolbar">
    <a-input :value="search" class="um-inp-search" allow-clear placeholder="搜索用户名..." @update:value="emit('update:search', $event)" />

    <a-select :value="roleFilter" class="um-inp-narrow" :options="roleOptions" @update:value="emit('update:roleFilter', $event)" />

    <a-select :value="statusFilter" class="um-inp-narrow" :options="statusOptions" @update:value="emit('update:statusFilter', $event)" />

    <span v-if="hasFilter" class="um-filter-count"> 共 {{ filteredCount }} / {{ totalCount }} 条 </span>
  </div>
</template>

<script setup>
defineProps({
  search: { type: String, required: true },
  roleFilter: { type: String, required: true },
  statusFilter: { type: String, required: true },
  roleOptions: { type: Array, required: true },
  statusOptions: { type: Array, required: true },
  hasFilter: { type: Boolean, required: true },
  filteredCount: { type: Number, required: true },
  totalCount: { type: Number, required: true },
});

const emit = defineEmits(["update:search", "update:roleFilter", "update:statusFilter"]);
</script>

<style scoped>
.um-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.um-inp-search {
  width: 220px;
}

.um-inp-narrow {
  width: 140px;
}

.um-filter-count {
  line-height: 32px;
  font-size: 13px;
  color: #999;
}
</style>
