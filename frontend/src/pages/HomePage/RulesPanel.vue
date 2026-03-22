<template>
  <SectionCard :icon="FileTextOutlined" title="代码规范Prompt" :body-style="{ padding: 0 }">
    <div class="rp-body">
      <div class="markdown-body rp-markdown">
        <MarkdownView :content="systemTemplate" />
      </div>
    </div>
  </SectionCard>
</template>

<script setup>
import { FileTextOutlined } from "@ant-design/icons-vue";
import MarkdownView from "@/components/MarkdownView.vue";
import SectionCard from "./SectionCard.vue";

defineProps({
  systemTemplate: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.rp-body {
  max-height: 480px;
  overflow: auto;
  padding: 20px;
  background-color: #fafbfc;
}
.rp-markdown {
  font-size: 14px;
  line-height: 1.7;
  color: #4e5969;
}
</style>
