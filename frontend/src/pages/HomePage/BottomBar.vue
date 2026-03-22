<template>
  <div class="bb-bar">
    <a-space :size="16">
      <a-button
        size="large"
        class="bb-copy"
        :class="{ 'bb-copy--success': copySuccess }"
        @click="onCopy"
      >
        <template #icon>
          <CheckCircleFilled v-if="copySuccess" />
          <CopyOutlined v-else />
        </template>
        {{ copySuccess ? "已复制！" : "复制完整提示词" }}
      </a-button>

      <a-button size="large" class="bb-preview" @click="onTogglePreview">
        <template #icon>
          <EyeInvisibleOutlined v-if="showPreview" />
          <EyeOutlined v-else />
        </template>
        {{ showPreview ? "隐藏" : "预览" }}
      </a-button>
    </a-space>
  </div>
</template>

<script setup>
import { CopyOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleFilled } from "@ant-design/icons-vue";

defineProps({
  copySuccess: { type: [Boolean, null], required: true },
  showPreview: { type: Boolean, required: true },
  onCopy: { type: Function, required: true },
  onTogglePreview: { type: Function, required: true },
});
</script>

<style scoped>
/* 与 constants.theme 保持一致 */
.bb-bar {
  position: fixed;
  bottom: 0;
  left: 240px;
  right: 0;
  padding: 16px 24px;
  text-align: center;
  background: #ffffff;
  border-top: 1px solid #e5e6eb;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

.bb-copy {
  min-width: 200px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  background: #000000;
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.3s;
  border: none;
}

.bb-copy--success {
  background: #00b42a;
}

.bb-preview {
  height: 48px;
  font-size: 15px;
  border-radius: 8px;
  min-width: 120px;
  border-color: #e5e6eb;
  color: #4e5969;
}
</style>
