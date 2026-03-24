<template>
  <div v-if="total > 0" class="hp-pager-wrap">
    <a-pagination
      :current="page"
      :page-size="pageSize"
      :total="total"
      :show-size-changer="true"
      :page-size-options="pageSizeOptions"
      show-less-items
      :show-total="showTotal"
      @update:current="emit('update:page', $event)"
      @update:page-size="onPageSizeChange"
    />
  </div>
</template>

<script setup>
defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true },
});

const pageSizeOptions = ["10", "15", "30", "50"];

const showTotal = (t) => `共 ${t} 条`;

const emit = defineEmits(["update:page", "update:pageSize"]);

const onPageSizeChange = (size) => {
  emit("update:pageSize", size);
  emit("update:page", 1);
};
</script>

<style scoped>
.hp-pager-wrap {
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;
}

.hp-pager-wrap :deep(.ant-pagination) {
  flex-wrap: wrap;
  justify-content: center;
  row-gap: 8px;
}
</style>
