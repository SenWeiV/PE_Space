<template>
  <a-modal :open="open" title="Skills 市场操作指南" :footer="null" width="680" @cancel="$emit('close')">
    <a-typography-paragraph>
      1) 点击下载按钮下载 `.zip`；2) 打开终端粘贴安装命令；3) Skill 会被安装到目标 Agent 的 skills 目录。
    </a-typography-paragraph>
    <a-divider />
    <a-typography-title :level="5">常用 CLI</a-typography-title>
    <pre class="skills-guide-code">curl {{ origin }}/api/cli/skills
curl {{ origin }}/api/cli/skills?q=keyword
curl {{ origin }}/api/cli/skills/skill-name
curl -o skill.zip {{ origin }}/api/cli/skills/skill-name/install</pre>
    <a-divider />
    <a-space>
      <a-button @click="$emit('download-bootstrap')">下载引导 Skill</a-button>
      <a-button type="primary" class="skills-primary-btn" @click="$emit('close')">我知道了</a-button>
    </a-space>
  </a-modal>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
});

defineEmits(["close", "download-bootstrap"]);

const origin = window.location.origin;
</script>

<style scoped>
.skills-primary-btn.ant-btn-primary { background: #000 !important; border-color: #000 !important; }
.skills-guide-code {
  margin: 0;
  background: #141414;
  color: #a3e635;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.8;
}
</style>
