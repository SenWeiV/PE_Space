<template>
  <a-modal
    title="编辑应用信息"
    :open="open"
    :confirm-loading="editSaving"
    ok-text="保存"
    cancel-text="取消"
    :width="520"
    @cancel="emit('close')"
    @ok="emit('save')"
  >
    <div v-if="app" class="al-edit-form">
      <div>
        <label class="al-edit-label">应用名称</label>
        <a-input v-model:value="editForm.name" placeholder="应用名称" />
      </div>

      <div>
        <label class="al-edit-label">应用说明</label>
        <a-textarea
          v-model:value="editForm.description"
          placeholder="应用说明（支持 Markdown）"
          :auto-size="{ minRows: 3, maxRows: 8 }"
        />
      </div>

      <div>
        <label class="al-edit-label">所有者</label>
        <a-select
          v-model:value="editForm.owner_id"
          class="al-edit-select"
          :options="ownerOptions"
        />
      </div>

      <div class="al-edit-slug">
        Slug: <code class="al-edit-code">{{ app.slug }}</code>
        <span class="al-edit-slug-note">（Slug 不可修改）</span>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
defineProps({
  open: { type: Boolean, required: true },
  app: { type: Object, default: null },
  editForm: { type: Object, required: true },
  editSaving: { type: Boolean, required: true },
  ownerOptions: { type: Array, required: true },
});

const emit = defineEmits(["close", "save"]);
</script>

<style scoped>
.al-edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 0;
}

.al-edit-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.al-edit-select {
  width: 100%;
}

.al-edit-slug {
  font-size: 12px;
  color: #999;
}

.al-edit-code {
  background: #f5f5f5;
  padding: 1px 4px;
  border-radius: 3px;
}

.al-edit-slug-note {
  margin-left: 8px;
}
</style>
