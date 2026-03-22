<template>
  <a-card>
    <a-descriptions :column="2">
      <a-descriptions-item label="状态">
        <a-badge :status="statusInfo.status" :text="statusInfo.text" />
      </a-descriptions-item>
      <a-descriptions-item label="作者">{{ app.owner.username }}</a-descriptions-item>
      <a-descriptions-item label="路径">/apps/{{ app.slug }}</a-descriptions-item>
      <a-descriptions-item label="端口">{{ app.host_port || "-" }}</a-descriptions-item>
      <a-descriptions-item label="容器 IP">{{ app.container_ip || "-" }}</a-descriptions-item>
      <a-descriptions-item label="创建时间">
        {{ dayjs(app.created_at).format("YYYY-MM-DD HH:mm") }}
      </a-descriptions-item>
      <a-descriptions-item label="描述">{{ app.description || "-" }}</a-descriptions-item>
    </a-descriptions>
  </a-card>
</template>

<script setup>
import dayjs from "dayjs";

defineProps({
  app: { type: Object, required: true },
  statusInfo: { type: Object, required: true },
});
</script>
