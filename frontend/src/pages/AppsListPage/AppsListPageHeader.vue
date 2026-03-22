<template>
  <div class="al-header">
    <div>
      <h1 class="al-title">应用管理</h1>
      <p class="al-subtitle">查看和管理所有应用</p>
    </div>

    <button v-if="showUpload" type="button" class="al-upload-btn" @click="emit('upload')">
      <span>＋</span> 上传 App
    </button>
  </div>
</template>

<script setup>
defineProps({
  showUpload: { type: Boolean, required: true },
});

const emit = defineEmits(["upload"]);
</script>

<style scoped>
.al-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.al-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 4px;
}

.al-subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.al-upload-btn {
  padding: 12px 24px;
  background: #2c2c2c;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.al-upload-btn:hover {
  background: #1a1a1a;
}
</style>
