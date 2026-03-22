<template>
  <div class="st-rank-block">
    <div class="st-block-title">应用使用排行</div>
    <div class="st-rank-row">
      <div v-if="apps.length === 0" class="st-empty-hint">暂无应用</div>
      <div
        v-else
        v-for="app in apps"
        :key="app.id"
        class="st-app-card"
        @click="emit('select', app)"
      >
        <div class="st-app-card-head">
          <span class="st-app-emoji">{{ iconFor(app.id) }}</span>
          <span class="st-app-name">{{ app.name }}</span>
        </div>
        <div class="st-app-runs">
          {{ app.run_count }}
          <span class="st-app-runs-suffix">次运行</span>
        </div>
        <div class="st-app-views">访问 {{ app.view_count }} 次</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  apps: { type: Array, required: true },
  iconFor: { type: Function, required: true },
});

const emit = defineEmits(["select"]);
</script>

<style scoped>
.st-rank-block {
  margin-bottom: 24px;
}

.st-block-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12px;
}

.st-rank-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.st-empty-hint {
  color: #999;
  font-size: 13px;
}

.st-app-card {
  flex: 0 0 auto;
  min-width: 160px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.st-app-card:hover {
  border-color: #d0d0d0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.st-app-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.st-app-emoji {
  font-size: 20px;
}

.st-app-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.st-app-runs {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1;
}

.st-app-runs-suffix {
  font-size: 13px;
  font-weight: 400;
  color: #999;
  margin-left: 4px;
}

.st-app-views {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}
</style>
