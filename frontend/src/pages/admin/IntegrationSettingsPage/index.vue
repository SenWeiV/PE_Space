<template>
  <div>
    <div class="int-header">
      <h1 class="int-title">集成与密钥</h1>
      <p class="int-desc">
        将团队 API、模型名称等保存在数据库中，避免在部署机 .env 明文长期留存。
        <a-tag color="red" class="int-tag-warn">仅管理员可访问本页</a-tag>
      </p>
      <p class="int-hint">
        此处展示的是<strong>已写入数据库</strong>的值。若某字段为空，后端业务逻辑仍可回退读取环境变量（TEAM_API_KEY
        等），但本页不会显示环境变量内容。IP 白名单请在侧栏「IP 白名单」单独配置。
      </p>
    </div>

    <a-alert v-if="saveOk" class="int-alert" type="success" message="已保存" show-icon closable @close="saveOk = false" />

    <a-card v-if="metaLine" class="int-meta" size="small">
      <span class="int-strong">最近更新：</span>{{ metaLine }}
    </a-card>

    <a-card title="配置项">
      <a-spin :spinning="loading">
        <div class="int-form">
          <div class="int-field">
            <div class="int-label">Team API Key</div>
            <a-input-password
              v-model:value="form.team_api_key"
              class="int-input"
              placeholder="留空可清空库中保存的密钥"
              autocomplete="off"
            />
          </div>
          <div class="int-field">
            <div class="int-label">Team Base URL</div>
            <a-input
              v-model:value="form.team_base_url"
              class="int-input"
              placeholder="例如 https://api.example.com/v1"
            />
          </div>
          <div class="int-field">
            <div class="int-label">Codex 模型</div>
            <a-input v-model:value="form.codex_model" class="int-input" placeholder="模型标识" />
          </div>
          <div class="int-field">
            <div class="int-label">OpenClaw 模型</div>
            <a-input v-model:value="form.openclaw_model" class="int-input" placeholder="模型标识" />
          </div>
        </div>
      </a-spin>

      <div class="int-actions">
        <a-button :disabled="loading" @click="reload">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
        <a-button type="primary" class="int-btn-primary" :loading="saving" :disabled="loading" @click="save">
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
import { getIntegrationSettings, updateIntegrationSettings } from "@/api/config";

const loading = ref(false);
const saving = ref(false);
const saveOk = ref(false);

const form = ref({
  team_api_key: "",
  team_base_url: "",
  codex_model: "",
  openclaw_model: "",
});

const updatedAt = ref(null);

const metaLine = computed(() => {
  if (!updatedAt.value) return "";
  return dayjs(updatedAt.value).format("YYYY-MM-DD HH:mm");
});

const reload = async () => {
  loading.value = true;
  saveOk.value = false;
  try {
    const { data } = await getIntegrationSettings();
    form.value = {
      team_api_key: data.team_api_key ?? "",
      team_base_url: data.team_base_url ?? "",
      codex_model: data.codex_model ?? "",
      openclaw_model: data.openclaw_model ?? "",
    };
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
    const { data } = await updateIntegrationSettings({ ...form.value });
    form.value = {
      team_api_key: data.team_api_key ?? "",
      team_base_url: data.team_base_url ?? "",
      codex_model: data.codex_model ?? "",
      openclaw_model: data.openclaw_model ?? "",
    };
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
.int-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.int-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 6px;
}

.int-desc {
  margin: 0 0 8px;
  font-size: 14px;
  color: #6b7280;
}

.int-hint {
  margin: 0;
  font-size: 13px;
  color: #86909c;
  max-width: 720px;
  line-height: 1.5;
}

.int-tag-warn {
  margin-left: 8px;
}

.int-alert {
  margin-bottom: 16px;
}

.int-meta {
  margin-bottom: 16px;
}

.int-strong {
  font-weight: 600;
  color: #333;
}

.int-form {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.int-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.int-input :deep(.ant-input),
.int-input :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
}

.int-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.int-btn-primary {
  background: #1a1a1a;
  border-color: #1a1a1a;
}

.int-btn-primary:hover {
  background: #333 !important;
  border-color: #333 !important;
}
</style>
