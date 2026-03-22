<template>
  <div class="home-page">
    <HomePageHeader />

    <a-alert
      v-if="copySuccess !== null"
      :message="copyMessage"
      :type="copySuccess ? 'success' : copyError ? 'warning' : 'info'"
      show-icon
      closable
      class="home-page__alert home-page__alert--slide"
      @close="clearStatus"
    />

    <a-alert
      v-if="speechErrorMsg"
      :message="speechErrorMsg"
      type="warning"
      show-icon
      closable
      class="home-page__alert"
      @close="speechErrorMsg = ''"
    />

    <a-row :gutter="[24, 24]">
      <a-col :xs="24" :lg="12">
        <RulesPanel :systemTemplate="systemTemplate" />
      </a-col>
      <a-col :xs="24" :lg="12">
        <RequirementEditor
          :value="userRequirement"
          :onChange="setUserRequirement"
          :onClear="handleClear"
          :onFillExample="handleFillExample"
        />
      </a-col>
    </a-row>

    <BottomBar
      :copySuccess="copySuccess"
      :showPreview="showPreview"
      :onCopy="handleCopy"
      :onTogglePreview="togglePreview"
    />

    <PromptPreviewModal
      :open="showPreview"
      :content="generateFullPrompt()"
      :onClose="closePreview"
      :onCopy="handleCopy"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { getTemplate } from "@/api/config";

import { EXAMPLE_REQUIREMENT, DEFAULT_SYSTEM_PROMPT_TEMPLATE } from "./constants";

import HomePageHeader from "./HomePageHeader.vue";
import RequirementEditor from "./RequirementEditor.vue";
import RulesPanel from "./RulesPanel.vue";
import BottomBar from "./BottomBar.vue";
import PromptPreviewModal from "./PromptPreviewModal.vue";
import { usePromptActions } from "./usePromptActions";

const userRequirement = ref(`工具名称：\n\n业务背景：\n\n输入：\n\n输出：`);
const systemTemplate = ref(DEFAULT_SYSTEM_PROMPT_TEMPLATE);
const showPreview = ref(false);
const speechErrorMsg = ref("");

const setUserRequirement = (v) => {
  userRequirement.value = v;
};

onMounted(() => {
  getTemplate()
    .then((res) => {
      systemTemplate.value = res.data.value;
    })
    .catch(() => {});
});

const { copySuccess, copyMessage, copyError, generateFullPrompt, handleCopy, clearStatus } = usePromptActions({
  userRequirement,
  systemTemplate,
  onShowPreview: () => {
    showPreview.value = true;
  },
});

const handleClear = () => {
  userRequirement.value = "";
  clearStatus();
};

const handleFillExample = () => {
  userRequirement.value = EXAMPLE_REQUIREMENT;
  clearStatus();
};

const togglePreview = () => {
  showPreview.value = !showPreview.value;
};

const closePreview = () => {
  showPreview.value = false;
};
</script>

<style scoped>
.home-page {
  padding: 0 0 100px;
  font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
}

.home-page__alert {
  margin-bottom: 20px;
  border-radius: 8px;
}

.home-page__alert--slide {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
