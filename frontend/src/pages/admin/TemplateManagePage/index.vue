<template>
  <div>
    <TemplateManagePageHeader />

    <a-alert
      v-if="saveSuccess"
      class="tmp-alert-mb"
      message="保存成功！代码规范 Prompt 已更新，所有用户将使用新版本。"
      type="success"
      show-icon
      closable
    />

    <a-alert v-if="hasChanges" class="tmp-alert-mb" type="warning" show-icon description="您有未保存的修改">
      <template #action>
        <a-button size="small" type="primary" class="tmp-btn-black" :loading="saving" @click="handleSave">
          立即保存
        </a-button>
      </template>
    </a-alert>

    <a-card v-if="config" class="tmp-meta-card" size="small">
      <a-space>
        <a-avatar :size="32" class="tmp-avatar-black">
          <template #icon>
            <UserOutlined />
          </template>
        </a-avatar>
        <div>
          <span class="tmp-strong">当前管理员：</span>
          <span>{{ user?.username }}</span>
        </div>
        <div class="tmp-meta-indent">
          <span class="tmp-strong">最后更新：</span>
          <span>{{ dayjs(config.updated_at).format("YYYY-MM-DD HH:mm") }}</span>
        </div>
        <div v-if="config.updater_name" class="tmp-meta-indent">
          <span class="tmp-strong">最后修改人：</span>
          <span>{{ config.updater_name }}</span>
        </div>
      </a-space>
    </a-card>

    <div v-if="loading" class="tmp-loading">
      <a-spin size="large" />
    </div>

    <a-tabs v-else v-model:activeKey="activeTab" @change="setActiveTab">
      <a-tab-pane :key="'edit'" force-render>
        <template #tab>
          <a-space><EditOutlined />编辑</a-space>
        </template>

        <a-card title="代码规范Prompt 内容">
          <template #extra>
            <a-space>
              <a-button @click="fetchTemplate">
                <template #icon><ReloadOutlined /></template>
                重新加载
              </a-button>
              <a-button
                type="primary"
                class="tmp-btn-black"
                :disabled="!hasChanges"
                :loading="saving"
                @click="handleSave"
              >
                <template #icon><SaveOutlined /></template>
                保存修改
              </a-button>
            </a-space>
          </template>

          <a-textarea
            :key="templateEditorKey"
            v-model:value="template"
            class="tmp-textarea"
            :rows="28"
            placeholder="请输入代码规范 Prompt 内容..."
          />
          <div class="tmp-hint-box">
            <p class="tmp-hint-text">
              此内容将作为首页的代码规范 Prompt 基础，与用户填写的需求拼接后生成完整提示词。支持 Markdown 格式。
            </p>
          </div>
        </a-card>
      </a-tab-pane>

      <a-tab-pane :key="'preview'">
        <template #tab>
          <a-space><EyeOutlined />预览</a-space>
        </template>
        <a-card title="预览效果">
          <div class="tmp-preview">{{ template }}</div>
        </a-card>
      </a-tab-pane>

      <a-tab-pane :key="'history'">
        <template #tab>
          <a-space><HistoryOutlined />修改历史</a-space>
        </template>
        <a-card title="修改历史">
          <a-spin :spinning="historyLoading">
            <template v-if="history.length === 0">
              <div class="tmp-history-empty">
                <span class="tmp-history-empty-text">暂无修改历史</span>
              </div>
            </template>

            <a-timeline v-else mode="left">
              <a-timeline-item
                v-for="(record, index) in history"
                :key="record.id"
                :label="dayjs(record.updated_at).format('YYYY-MM-DD HH:mm')"
                :color="index === 0 ? 'green' : 'gray'"
              >
                <a-card class="tmp-history-card" size="small">
                  <template #actions>
                    <a-button type="link" size="small" @click="handleRestoreVersion(record)"> 恢复此版本 </a-button>
                  </template>
                  <a-space>
                    <a-avatar size="small" class="tmp-tl-avatar" :class="{ 'tmp-tl-avatar--latest': index === 0 }">
                      <template #icon><UserOutlined /></template>
                    </a-avatar>
                    <span class="tmp-strong">{{ record.updater_name || "未知" }}</span>
                    <a-tag v-if="index === 0" color="default">当前版本</a-tag>
                  </a-space>
                </a-card>
              </a-timeline-item>
            </a-timeline>
          </a-spin>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import dayjs from "dayjs";
import { getTemplate, updateTemplate, getTemplateHistory } from "@/api/config";
import { message, Modal } from "ant-design-vue";
import {
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import { getStoredUser } from "@/utils/authStorage";
import TemplateManagePageHeader from "./TemplateManagePageHeader.vue";

const user = ref(getStoredUser());

const loading = ref(true);
const saving = ref(false);
const historyLoading = ref(false);
const saveSuccess = ref(false);

const config = ref(null);
const template = ref("");
const originalTemplate = ref("");
/** 程序化改写内容后递增，强制 TextArea 重新挂载，避免与 v-model 不同步导致无法保存 */
const templateEditorKey = ref(0);
const activeTab = ref("edit");
const history = ref([]);

const hasChanges = computed(() => template.value !== originalTemplate.value);

const setActiveTab = (key) => {
  activeTab.value = key;
};

const fetchTemplate = async () => {
  loading.value = true;
  try {
    const res = await getTemplate();
    config.value = res.data;
    template.value = res.data.value;
    originalTemplate.value = res.data.value;
    templateEditorKey.value += 1;
  } finally {
    loading.value = false;
  }
};

const fetchHistory = async () => {
  historyLoading.value = true;
  try {
    const res = await getTemplateHistory();
    history.value = res.data;
  } finally {
    historyLoading.value = false;
  }
};

const handleSave = () => {
  Modal.confirm({
    title: "确认保存修改？",
    icon: null,
    content: `修改后的代码规范 Prompt 将立即对所有用户生效。\n当前管理员：${user.value?.username}`,
    onOk: async () => {
      saving.value = true;
      try {
        const res = await updateTemplate(template.value);
        config.value = res.data;
        originalTemplate.value = template.value;
        saveSuccess.value = true;
        message.success("保存成功");
        setTimeout(() => {
          saveSuccess.value = false;
        }, 3000);
      } finally {
        saving.value = false;
      }
    },
  });
};

const handleRestoreVersion = (record) => {
  Modal.confirm({
    title: "确认恢复此版本？",
    icon: null,
    content: `将恢复到 ${dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")} 的版本，当前编辑内容将被覆盖。`,
    onOk: async () => {
      template.value = record.value ?? "";
      activeTab.value = "edit";
      await nextTick();
      templateEditorKey.value += 1;
    },
  });
};

watch(activeTab, (v) => {
  if (v === "history") fetchHistory();
});

onMounted(() => {
  fetchTemplate();
});
</script>

<style scoped>
.tmp-alert-mb {
  margin-bottom: 16px;
}

.tmp-meta-card {
  margin-bottom: 16px;
  background: #fafafa;
}

.tmp-strong {
  font-weight: 600;
}

.tmp-meta-indent {
  margin-left: 24px;
}

.tmp-loading {
  text-align: center;
  padding: 80px;
}

.tmp-btn-black.ant-btn-primary {
  background: #000 !important;
  border-color: #000 !important;
}

.tmp-avatar-black {
  background-color: #000 !important;
}

.tmp-textarea {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
}

.tmp-hint-box {
  margin-top: 12px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.tmp-hint-text {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.tmp-preview {
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  max-height: 600px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
}

.tmp-history-empty {
  text-align: center;
  padding: 40px;
}

.tmp-history-empty-text {
  color: #6b7280;
  font-weight: 500;
}

.tmp-history-card {
  margin-bottom: 8px;
}

.tmp-tl-avatar {
  background-color: #bfbfbf !important;
}

.tmp-tl-avatar--latest {
  background-color: #000 !important;
}
</style>
