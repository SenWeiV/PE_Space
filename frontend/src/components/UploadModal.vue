<template>
  <a-modal
    :open="open"
    :width="560"
    :confirm-loading="loading"
    :title="isUpdateMode ? `更新工具：${targetApp?.name}` : '上传新工具'"
    :ok-text="okText"
    cancel-text="取消"
    @cancel="handleClose"
    @ok="handleOk"
    :destroy-on-close="false"
  >
    <a-steps :current="displayStep" :items="steps" class="um-steps" />

    <!-- Step 0: Basic info -->
    <div v-if="step === 0">
      <div class="um-field">
        <div class="um-label">工具名称</div>
        <a-input v-model:value="form.name" placeholder="如：数据清洗工具" />
      </div>

      <div class="um-field">
        <div class="um-label">URL 路径 (slug)</div>
        <a-input v-model:value="form.slug" placeholder="data-cleaner" />
        <div class="um-hint">只允许小写字母、数字、连字符，如 data-cleaner</div>
      </div>

      <div class="um-field um-field--tight">
        <div class="um-label">工具描述</div>
        <a-textarea v-model:value="form.description" :rows="3" placeholder="简单描述这个工具的用途..." />
      </div>
    </div>

    <!-- Step 1: Upload zip -->
    <div v-if="step === 1">
      <a-alert
        type="info"
        show-icon
        message="zip 包要求"
        class="um-alert-mb"
      >
        <template #description>
          <ul class="um-ul">
            <li>必须包含 <code>app.py</code>（Streamlit 入口文件）</li>
            <li>必须包含 <code>requirements.txt</code>（依赖列表）</li>
            <li>平台会自动注入 Dockerfile，无需手动提供</li>
          </ul>
        </template>
      </a-alert>

      <a-alert
        v-if="isUpdateMode"
        type="warning"
        show-icon
        message="上传新版本将覆盖原有代码并重新部署"
        class="um-alert-mb"
      />

      <a-upload-dragger
        accept=".zip"
        :max-count="1"
        :before-upload="beforeUpload"
        :show-upload-list="false"
        :on-remove="onRemove"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">点击或拖拽 zip 文件到此区域</p>
        <p class="ant-upload-hint">仅支持 .zip 格式</p>
      </a-upload-dragger>
    </div>

    <!-- Step 2: Confirm deploy -->
    <div v-if="step === 2">
      <a-alert
        type="success"
        show-icon
        message="准备就绪"
        :description="isUpdateMode ? '新版本已上传。点击「开始部署」后，平台将停止旧容器并重新构建，完成后工具自动更新。' : '文件已上传成功。点击「开始部署」后，平台将在后台构建 Docker 镜像并启动服务，构建约需 1-3 分钟，完成后可在 App 列表中查看状态。'"
      />
    </div>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { InboxOutlined } from "@ant-design/icons-vue";
import { createApp, deployApp, uploadZip } from "@/api/apps";
import { message } from "ant-design-vue";

const props = defineProps({
  open: { type: Boolean, required: true },
  onClose: { type: Function, required: true },
  onSuccess: { type: Function, required: true },
  // update mode: jump to upload step
  targetApp: {
    type: Object,
    default: undefined,
  },
});

const isUpdateMode = computed(() => !!props.targetApp);

const step = ref(isUpdateMode.value ? 1 : 0);
const loading = ref(false);
const createdAppId = ref(isUpdateMode.value ? props.targetApp?.id : null);
const zipFile = ref(null);

const form = reactive({
  name: "",
  slug: "",
  description: "",
});

const steps = computed(() => {
  return isUpdateMode.value
    ? [{ title: "上传新版本" }, { title: "确认部署" }]
    : [{ title: "基本信息" }, { title: "上传文件" }, { title: "确认部署" }];
});

// 映射显示步骤（更新模式 step=1 对应展示第 0 项，step=2 对应展示第 1 项）
const displayStep = computed(() => (isUpdateMode.value ? step.value - 1 : step.value));

const okText = computed(() => (step.value === 0 ? "下一步" : step.value === 1 ? "上传" : "开始部署"));

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    step.value = isUpdateMode.value ? 1 : 0;
    createdAppId.value = isUpdateMode.value ? props.targetApp?.id : null;
    zipFile.value = null;
    loading.value = false;
    form.name = "";
    form.slug = "";
    form.description = "";
  },
  { immediate: true }
);

const handleClose = () => {
  loading.value = false;
  step.value = isUpdateMode.value ? 1 : 0;
  createdAppId.value = isUpdateMode.value ? props.targetApp?.id : null;
  zipFile.value = null;
  form.name = "";
  form.slug = "";
  form.description = "";
  props.onClose();
};

const validateStep1 = () => {
  if (!form.name.trim()) {
    message.error("请填写名称");
    return false;
  }
  const slugRe = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
  if (!form.slug.trim() || !slugRe.test(form.slug.trim())) {
    message.error("只允许小写字母、数字、连字符，长度 3-64");
    return false;
  }
  return true;
};

const handleStep1 = async () => {
  if (!validateStep1()) return;
  loading.value = true;
  try {
    const res = await createApp({
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() ? form.description.trim() : undefined,
    });
    createdAppId.value = res.data.id;
    step.value = 1;
  } catch (e) {
    message.error(e?.response?.data?.detail || "创建失败");
  } finally {
    loading.value = false;
  }
};

const beforeUpload = (file) => {
  zipFile.value = file.originFileObj ?? file;
  return false;
};

const onRemove = () => {
  zipFile.value = null;
};

const handleStep2 = async () => {
  if (!zipFile.value || !createdAppId.value) return;
  loading.value = true;
  try {
    await uploadZip(createdAppId.value, zipFile.value);
    step.value = 2;
  } catch (e) {
    const d = e?.response?.data?.detail;
    const text = Array.isArray(d) ? d.map((x) => x?.msg || x).join("; ") : d;
    message.error(text || e?.message || "上传失败");
  } finally {
    loading.value = false;
  }
};

const handleDeploy = async () => {
  if (!createdAppId.value) return;
  loading.value = true;
  try {
    await deployApp(createdAppId.value);
    message.success(
      isUpdateMode.value
        ? "更新部署已提交，正在重新构建..."
        : "部署任务已提交，正在构建中..."
    );
    props.onSuccess();
    handleClose();
  } catch (e) {
    message.error(e?.response?.data?.detail || "部署失败");
  } finally {
    loading.value = false;
  }
};

const handleOk = () => {
  if (step.value === 0) return handleStep1();
  if (step.value === 1) return handleStep2();
  return handleDeploy();
};
</script>

<style scoped>
.um-steps {
  margin-bottom: 24px;
}

.um-field {
  margin-bottom: 16px;
}

.um-field--tight {
  margin-bottom: 8px;
}

.um-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.um-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

.um-alert-mb {
  margin-bottom: 16px;
}

.um-ul {
  margin: 4px 0;
  padding-left: 16px;
}
</style>

