<template>
  <FileExcelOutlined v-if="isExcel" class="file-icon file-icon--excel" />
  <FileTextOutlined v-else-if="isJson" class="file-icon file-icon--json" />
  <FileOutlined v-else class="file-icon file-icon--default" />
</template>

<script setup>
import { computed } from "vue";
import { FileExcelOutlined, FileTextOutlined, FileOutlined } from "@ant-design/icons-vue";

const props = defineProps({
  name: { type: String, required: true },
});

const isExcel = computed(() => {
  const n = props.name || "";
  return n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv");
});

const isJson = computed(() => {
  const n = props.name || "";
  return n.endsWith(".jsonl") || n.endsWith(".json");
});
</script>

<style scoped>
.file-icon {
  margin-right: 4px;
}
.file-icon--excel {
  color: #52c41a;
}
.file-icon--json {
  color: #1677ff;
}
.file-icon--default {
  color: #999;
}
</style>
