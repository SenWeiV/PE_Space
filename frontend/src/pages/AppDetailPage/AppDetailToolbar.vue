<template>
  <div class="adp-toolbar">
    <div>
      <h4 class="adp-title">{{ app?.name }}</h4>
    </div>

    <div class="adp-actions">
      <template v-if="app?.status === 'running'">
        <a-button v-if="accessUrl" type="primary" :href="accessUrl" target="_blank">访问应用</a-button>
        <a-button @click="emit('stop')">停止</a-button>
      </template>
      <template v-else-if="app?.status === 'stopped'">
        <a-button type="primary" @click="emit('restart')">重启</a-button>
      </template>

      <a-popconfirm title="确认删除？" @confirm="emit('delete')">
        <a-button danger>删除</a-button>
      </a-popconfirm>
    </div>
  </div>
</template>

<script setup>
defineProps({
  app: { type: Object, default: null },
  accessUrl: { type: String, default: undefined },
});

const emit = defineEmits(["stop", "restart", "delete"]);
</script>

<style scoped>
.adp-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.adp-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.adp-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
