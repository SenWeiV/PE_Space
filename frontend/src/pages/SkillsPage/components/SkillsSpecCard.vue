<template>
  <a-card class="skills-spec" size="small">
    <template #title>
      <a-space><FileProtectOutlined /> Skills 发布规范</a-space>
    </template>
    <template #extra>
      <a-space>
        <a-button v-if="isAdmin && !specEditing" size="small" @click="$emit('update:specEditing', true)">编辑</a-button>
        <a-button v-if="isAdmin && specEditing" size="small" type="primary" :loading="specSaving" @click="$emit('save')">保存</a-button>
        <a-button v-if="specEditing" size="small" @click="$emit('cancel-edit')">取消</a-button>
      </a-space>
    </template>
    <a-textarea v-if="specEditing" :value="specDraft" :rows="6" @update:value="$emit('update:specDraft', $event)" />
    <div v-else class="skills-spec-content">{{ specContent || "暂未编写规范" }}</div>
  </a-card>
</template>

<script setup>
import { FileProtectOutlined } from "@ant-design/icons-vue";

defineProps({
  isAdmin: { type: Boolean, default: false },
  specEditing: { type: Boolean, default: false },
  specSaving: { type: Boolean, default: false },
  specDraft: { type: String, default: "" },
  specContent: { type: String, default: "" },
});

defineEmits(["update:specEditing", "update:specDraft", "save", "cancel-edit"]);
</script>

<style scoped>
.skills-spec { margin-bottom: 16px; }
.skills-spec-content { white-space: pre-wrap; color: #444; min-height: 42px; }
</style>
