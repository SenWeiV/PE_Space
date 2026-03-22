<template>
  <a-modal :open="open" width="900" :closable="true" @cancel="onClose">
    <template #title>
      <a-space>
        <EyeOutlined class="ppm-title-icon" />
        <span class="ppm-title-text">完整提示词预览</span>
      </a-space>
    </template>

    <a-textarea :value="content" :rows="20" :readonly="true" class="ppm-textarea" />

    <template #footer>
      <a-space>
        <a-button @click="onClose">关闭</a-button>
        <a-button type="primary" class="ppm-copy-btn" @click="handleCopyAndClose">
          <template #icon>
            <CopyOutlined />
          </template>
          复制并关闭
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<script setup>
import { EyeOutlined, CopyOutlined } from "@ant-design/icons-vue";

const { open, content, onClose, onCopy } = defineProps({
  open: { type: Boolean, required: true },
  content: { type: String, required: true },
  onClose: { type: Function, required: true },
  onCopy: { type: Function, required: true },
});

const handleCopyAndClose = () => {
  onCopy();
  onClose();
};
</script>

<style scoped>
.ppm-title-icon {
  color: #000000;
}
.ppm-title-text {
  font-weight: 600;
}
.ppm-textarea {
  font-family: monospace;
  font-size: 13px;
  background-color: #fafbfc;
  border-radius: 8px;
  margin-top: 8px;
}
.ppm-copy-btn {
  background: #000000 !important;
  border-color: #000000 !important;
}
</style>
