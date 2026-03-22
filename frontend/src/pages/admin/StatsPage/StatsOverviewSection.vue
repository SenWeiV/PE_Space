<template>
  <div class="st-overview-row">
    <div v-for="item in items" :key="item.label" class="st-stat-card">
      <div class="st-stat-icon">{{ item.icon }}</div>
      <div class="st-stat-value">{{ item.value }}</div>
      <div class="st-stat-label">{{ item.label }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
});
</script>

<style scoped>
.st-overview-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.st-stat-card {
  flex: 1 1 140px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 20px 24px;
}

.st-stat-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.st-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1;
}

.st-stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 6px;
}
</style>
