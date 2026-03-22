<template>
  <div v-if="totalPages > 1" class="hp-pager">
    <button type="button" class="hp-page-btn" :disabled="page <= 1" @click="emit('update:page', Math.max(1, page - 1))">
      上一页
    </button>
    <span class="hp-page-info">{{ page }} / {{ totalPages }}</span>
    <button
      type="button"
      class="hp-page-btn"
      :disabled="page >= totalPages"
      @click="emit('update:page', Math.min(totalPages, page + 1))"
    >
      下一页
    </button>
  </div>
</template>

<script setup>
defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
});

const emit = defineEmits(["update:page"]);
</script>

<style scoped>
.hp-pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 24px 0 16px;
}

.hp-page-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
}

.hp-page-btn:disabled {
  background: #fafafa;
  color: #ccc;
  cursor: not-allowed;
}

.hp-page-info {
  font-size: 13px;
  color: #666;
  padding: 0 12px;
}
</style>
