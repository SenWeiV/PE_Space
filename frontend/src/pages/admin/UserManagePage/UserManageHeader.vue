<template>
  <div class="um-header">
    <h1 class="um-title">用户管理</h1>
    <div class="um-header-actions">
      <a-button @click="emit('batch')">
        <template #icon><TeamOutlined /></template>
        批量创建标注账号
      </a-button>
      <a-button type="primary" class="um-btn-black" @click="emit('create')">
        <template #icon><PlusOutlined /></template>
        创建用户
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { PlusOutlined, TeamOutlined } from "@ant-design/icons-vue";

const emit = defineEmits(["batch", "create"]);
</script>

<style scoped>
.um-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.um-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0;
}

.um-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.um-btn-black.ant-btn-primary {
  background: #000 !important;
  border-color: #000 !important;
}
</style>
