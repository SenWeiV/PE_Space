<template>
  <a-card>
    <pre ref="logRef" class="adp-log-pre">
      {{ log || "暂无日志" }}
    </pre>
  </a-card>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  log: { type: String, required: true },
});

const logRef = ref(null);

const scrollToEnd = () => {
  if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight;
};

defineExpose({ scrollToEnd });
</script>

<style scoped>
.adp-log-pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 6px;
  min-height: 200px;
  max-height: 500px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
