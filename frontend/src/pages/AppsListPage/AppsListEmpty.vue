<template>
  <div class="al-empty">
    <div class="al-empty-icon">📱</div>

    <h3 class="al-empty-title">
      {{ noApps ? "暂无应用" : "没有匹配的应用" }}
    </h3>

    <div v-if="noApps">
      <p class="al-empty-desc">上传你的第一个 App 吧</p>
      <button type="button" class="al-upload-btn al-upload-btn--inline" @click="emit('upload')">＋ 上传 App</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  noApps: { type: Boolean, required: true },
});

const emit = defineEmits(["upload"]);
</script>

<style scoped>
.al-empty {
  text-align: center;
  padding: 80px 20px;
}

.al-empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

.al-empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px;
}

.al-empty-desc {
  color: #666;
  margin-bottom: 24px;
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

.al-upload-btn--inline {
  margin: 0 auto;
  display: inline-flex;
}
</style>
