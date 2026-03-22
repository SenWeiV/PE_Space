<template>
  <div>
    <div class="ip-header">
      <h1 class="ip-title">IP 访问白名单</h1>
      <p class="ip-desc">
        规则保存在数据库表 <code>system_configs</code>（键 <code>ip_allowlist</code>），保存后立即生效于当前后端进程。
        <a-tag color="red" class="ip-tag-warn">仅管理员</a-tag>
      </p>
      <p class="ip-hint">
        若库中<strong>从未写入</strong>该键，运行时才会回退环境变量 <code>IP_ALLOWLIST</code>；本页展示的是<strong>已入库</strong>内容。
        全部清空并保存即关闭白名单。默认 <code>IP_ALLOWLIST_ALLOW_LOOPBACK=true</code> 时本机回环始终放行——用
        <code>npm run dev</code> 走 Vite 代理访问 API 时，后端常看到 <code>127.0.0.1</code>，白名单会因此看起来「拦不住」；若需本机也受控，请在 .env 设
        <code>IP_ALLOWLIST_ALLOW_LOOPBACK=false</code> 并把 <code>127.0.0.1</code> 写入白名单（或直连后端端口测试）。
      </p>
    </div>

    <a-alert v-if="saveOk" class="ip-alert" type="success" message="已写入数据库并刷新白名单缓存" show-icon closable @close="saveOk = false" />

    <a-card v-if="metaLine" class="ip-meta" size="small">
      <span class="ip-strong">最近保存：</span>{{ metaLine }}
    </a-card>

    <a-card title="允许访问的 IP / 网段">
      <p class="ip-card-desc">
        每行一条或逗号分隔；支持 IPv4/IPv6 与 CIDR（如 <code>10.0.0.0/8</code>）。前置反向代理时依赖
        <code>IP_ALLOWLIST_TRUST_X_FORWARDED_FOR</code>（.env）解析真实客户端 IP。
      </p>
      <a-spin :spinning="loading">
        <a-textarea
          v-model:value="text"
          class="ip-textarea"
          :rows="14"
          placeholder="示例：&#10;203.0.113.10&#10;198.51.100.0/24"
          :disabled="loading"
        />
      </a-spin>
      <div class="ip-actions">
        <a-button :disabled="loading" @click="reload">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
        <a-button type="primary" class="ip-btn-primary" :loading="saving" :disabled="loading" @click="save">
          <template #icon><SaveOutlined /></template>
          保存到数据库
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";
import { message } from "ant-design-vue";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons-vue";
import { getIpAllowlist, updateIpAllowlist } from "@/api/config";

const loading = ref(false);
const saving = ref(false);
const saveOk = ref(false);
const text = ref("");
const updatedAt = ref(null);

const metaLine = computed(() => {
  if (!updatedAt.value) return "";
  return dayjs(updatedAt.value).format("YYYY-MM-DD HH:mm");
});

const reload = async () => {
  loading.value = true;
  saveOk.value = false;
  try {
    const { data } = await getIpAllowlist();
    text.value = data.value ?? "";
    updatedAt.value = data.updated_at ?? null;
  } catch (e) {
    message.error(e?.response?.data?.detail || "加载失败");
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  saveOk.value = false;
  try {
    const { data } = await updateIpAllowlist(text.value);
    text.value = data.value ?? "";
    updatedAt.value = data.updated_at ?? null;
    saveOk.value = true;
    message.success("已保存");
  } catch (e) {
    message.error(e?.response?.data?.detail || "保存失败");
  } finally {
    saving.value = false;
  }
};

onMounted(reload);
</script>

<style scoped>
.ip-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.ip-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 6px;
}

.ip-desc {
  margin: 0 0 8px;
  font-size: 14px;
  color: #6b7280;
}

.ip-hint {
  margin: 0;
  font-size: 13px;
  color: #86909c;
  max-width: 800px;
  line-height: 1.55;
}

.ip-tag-warn {
  margin-left: 8px;
}

.ip-alert {
  margin-bottom: 16px;
}

.ip-meta {
  margin-bottom: 16px;
}

.ip-strong {
  font-weight: 600;
  color: #333;
}

.ip-card-desc {
  font-size: 13px;
  color: #86909c;
  line-height: 1.55;
  margin: 0 0 12px;
  max-width: 800px;
}

.ip-textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  border-radius: 8px;
}

.ip-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.ip-btn-primary {
  background: #1a1a1a;
  border-color: #1a1a1a;
}

.ip-btn-primary:hover {
  background: #333 !important;
  border-color: #333 !important;
}
</style>
