<template>
  <div>
    <UserManageHeader @batch="batchOpen = true" @create="createOpen = true" />

    <UserManageToolbar
      v-model:search="search"
      v-model:role-filter="roleFilter"
      v-model:status-filter="statusFilter"
      :role-options="roleOptions"
      :status-options="statusOptions"
      :has-filter="hasFilter"
      :filtered-count="filteredUsers.length"
      :total-count="users.length"
    />

    <a-table row-key="id" :data-source="filteredUsers" :columns="columns" :loading="loading" :locale="{ emptyText }" />

    <!-- 单个创建 -->
    <a-modal
      title="创建用户"
      :open="createOpen"
      :ok-button-props="{ style: { display: 'none' } }"
      :footer="null"
      width="520"
      @cancel="onCreateCancel"
    >
      <div class="um-modal-form">
        <a-input v-model:value="createForm.username" placeholder="用户名" />
        <a-input-password v-model:value="createForm.password" placeholder="密码（至少6位）" />
        <a-select v-model:value="createForm.role" class="um-full" :options="roleSelectOptions" />
        <a-date-picker v-model:value="createForm.expires_at" class="um-full" placeholder="不填则永不过期" />

        <div class="um-modal-footer">
          <a-button @click="onCreateCancel">取消</a-button>
          <a-button type="primary" class="um-btn-black" @click="handleCreateOk"> 创建 </a-button>
        </div>
      </div>
    </a-modal>

    <!-- 批量创建标注账号 -->
    <a-modal
      title="批量创建标注账号"
      :open="batchOpen"
      :footer="null"
      width="560"
      @cancel="onBatchCancel"
    >
      <div class="um-modal-form">
        <a-input v-model:value="batchForm.project_name" placeholder="例如：AI标注2024" />
        <a-input-number v-model:value="batchForm.start_index" class="um-full" :min="1" />
        <a-input-number
          v-model:value="batchForm.count"
          class="um-full"
          :min="1"
          :max="200"
          placeholder="最多200个"
        />
        <a-input-password v-model:value="batchForm.password" placeholder="所有账号使用相同密码" />
        <a-date-picker v-model:value="batchForm.expires_at" class="um-full" placeholder="不填则永不过期" />

        <div class="um-batch-hint">用户名将生成为：项目名称_001, 项目名称_002, ...</div>

        <div class="um-modal-footer">
          <a-button @click="onBatchCancel">取消</a-button>
          <a-button type="primary" class="um-btn-black" @click="handleBatchCreateOk"> 批量创建 </a-button>
        </div>
      </div>
    </a-modal>

    <!-- 批量创建结果 -->
    <a-modal
      :title="`批量创建成功 — 共 ${batchResult.length} 个账号`"
      :open="batchResultOpen"
      :footer="null"
      width="500"
      @cancel="batchResultOpen = false"
    >
      <div class="um-result-scroll">
        <a-table
          row-key="id"
          :data-source="batchResult"
          size="small"
          :pagination="false"
          :columns="batchResultColumns"
        />
      </div>
      <template #footer>
        <div class="um-result-footer">
          <a-button @click="batchResultOpen = false">关闭</a-button>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, h, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import client from "@/api/client";
import { message } from "ant-design-vue";
import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tag,
  Modal,
} from "ant-design-vue";
import UserManageHeader from "./UserManageHeader.vue";
import UserManageToolbar from "./UserManageToolbar.vue";

const users = ref([]);
const loading = ref(false);

const search = ref("");
const roleFilter = ref("all");
const statusFilter = ref("all");

const roleOptions = [
  { value: "all", label: "全部角色" },
  { value: "admin", label: "管理员" },
  { value: "user", label: "普通用户" },
  { value: "annotator", label: "标注账号" },
];

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "disabled", label: "已禁用" },
  { value: "expired", label: "已过期" },
];

const roleSelectOptions = [
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
  { value: "annotator", label: "标注账号（仅首页+应用管理）" },
];

const roleColor = {
  admin: "purple",
  user: "blue",
  annotator: "orange",
};
const roleLabel = {
  admin: "管理员",
  user: "普通用户",
  annotator: "标注账号",
};

const statusTagText = (isActive) => (isActive ? "正常" : "禁用");

const filteredUsers = computed(() => {
  const kw = search.value.trim().toLowerCase();
  return (users.value || []).filter((u) => {
    if (kw && !(u.username || "").toLowerCase().includes(kw)) return false;
    if (roleFilter.value !== "all" && u.role !== roleFilter.value) return false;
    if (statusFilter.value === "active" && !u.is_active) return false;
    if (statusFilter.value === "disabled" && u.is_active) return false;
    if (statusFilter.value === "expired") {
      if (!u.expires_at || !dayjs(u.expires_at).isBefore(dayjs())) return false;
    }
    return true;
  });
});

const hasFilter = computed(() => !!search.value.trim() || roleFilter.value !== "all" || statusFilter.value !== "all");

const emptyText = computed(() => {
  return h("div", { class: "um-table-empty" }, [
    h("div", { class: "um-table-empty__icon" }, "👤"),
    h(
      "div",
      { class: "um-table-empty__title" },
      users.value.length === 0 ? "暂无用户" : "没有匹配的用户",
    ),
    h(
      "div",
      { class: "um-table-empty__sub" },
      users.value.length === 0 ? "点击右上角「创建用户」添加第一个账号" : "尝试调整筛选条件",
    ),
  ]);
});

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res = await client.get("/admin/users");
    users.value = res.data || [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchUsers();
});

const handleToggleActive = async (user) => {
  await client.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
  message.success(user.is_active ? "已禁用" : "已启用");
  fetchUsers();
};

const handleDelete = async (userId) => {
  await client.delete(`/admin/users/${userId}`);
  message.success("已删除");
  fetchUsers();
};

const columns = computed(() => [
  { title: "ID", dataIndex: "id", key: "id", width: 60 },
  { title: "用户名", dataIndex: "username", key: "username" },
  {
    title: "角色",
    dataIndex: "role",
    key: "role",
    customRender: ({ text }) =>
      h(Tag, { color: roleColor[text] ?? "default" }, () => roleLabel[text] ?? text),
  },
  {
    title: "状态",
    dataIndex: "is_active",
    key: "is_active",
    customRender: ({ text }) =>
      h(Tag, { color: text ? "green" : "red" }, () => statusTagText(!!text)),
  },
  {
    title: "过期时间",
    dataIndex: "expires_at",
    key: "expires_at",
    customRender: ({ text }) => {
      if (!text) return h("span", { class: "um-expires-never" }, "永不过期");
      const expired = dayjs(text).isBefore(dayjs());
      return h(
        "span",
        { class: expired ? "um-expires-bad" : "um-expires-ok" },
        `${dayjs(text).format("YYYY-MM-DD")}${expired ? " (已过期)" : ""}`,
      );
    },
  },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    customRender: ({ text }) => h("span", null, dayjs(text).format("YYYY-MM-DD")),
  },
  {
    title: "操作",
    key: "actions",
    customRender: ({ record }) =>
      h(
        Space,
        { size: "small" },
        () => [
          h(
            Button,
            {
              size: "small",
              onClick: () => handleToggleActive(record),
            },
            () => (record.is_active ? "禁用" : "启用"),
          ),
          h(
            Popconfirm,
            {
              title: "确认删除该用户？",
              content: "删除后无法恢复",
              okText: "删除",
              cancelText: "取消",
              okButtonProps: { danger: true },
              onConfirm: () => handleDelete(record.id),
            },
            () =>
              h(
                Button,
                {
                  size: "small",
                  danger: true,
                },
                () => "删除",
              ),
          ),
        ],
      ),
  },
]);

// Create user modal form
const createOpen = ref(false);
const createForm = reactive({
  username: "",
  password: "",
  role: "user",
  expires_at: null,
});

const resetCreateForm = () => {
  createForm.username = "";
  createForm.password = "";
  createForm.role = "user";
  createForm.expires_at = null;
};

const onCreateCancel = () => {
  createOpen.value = false;
  resetCreateForm();
};

const validateCreate = () => {
  if (!createForm.username.trim()) return "请输入用户名";
  if (!createForm.password || createForm.password.length < 6) return "密码至少6位";
  return null;
};

const handleCreateOk = async () => {
  const err = validateCreate();
  if (err) return message.error(err);
  const payload = {
    username: createForm.username.trim(),
    password: createForm.password,
    role: createForm.role,
    expires_at: createForm.expires_at ? createForm.expires_at.toISOString() : null,
  };
  try {
    await client.post("/admin/users", payload);
    message.success("创建成功");
    createOpen.value = false;
    resetCreateForm();
    fetchUsers();
  } catch (e) {
    message.error(e?.response?.data?.detail || "创建失败");
  }
};

// Batch create modal form
const batchOpen = ref(false);
const batchForm = reactive({
  project_name: "",
  start_index: 1,
  count: null,
  password: "",
  expires_at: null,
});

const resetBatchForm = () => {
  batchForm.project_name = "";
  batchForm.start_index = 1;
  batchForm.count = null;
  batchForm.password = "";
  batchForm.expires_at = null;
};

const onBatchCancel = () => {
  batchOpen.value = false;
  resetBatchForm();
};

const batchResultOpen = ref(false);
const batchResult = ref([]);

const batchResultColumns = computed(() => [
  { title: "用户名", dataIndex: "username", key: "username" },
  {
    title: "过期时间",
    dataIndex: "expires_at",
    key: "expires_at",
    customRender: ({ text }) => (text ? dayjs(text).format("YYYY-MM-DD") : "永不过期"),
  },
]);

const handleBatchCreateOk = async () => {
  if (!batchForm.project_name.trim()) return message.error("请输入项目名称");
  if (!batchForm.count || batchForm.count < 1) return message.error("请输入数量");
  if (!batchForm.password || batchForm.password.length < 6) return message.error("密码至少6位");

  const payload = {
    project_name: batchForm.project_name.trim(),
    start_index: batchForm.start_index ?? 1,
    count: batchForm.count,
    password: batchForm.password,
    expires_at: batchForm.expires_at ? batchForm.expires_at.toISOString() : null,
  };

  try {
    const res = await client.post("/admin/users/batch", payload);
    message.success(`成功创建 ${res.data.length} 个标注账号`);
    batchOpen.value = false;
    resetBatchForm();
    batchResult.value = res.data || [];
    batchResultOpen.value = true;
    fetchUsers();
  } catch (e) {
    message.error(e?.response?.data?.detail || "批量创建失败");
  }
};
</script>

<style scoped>
.um-btn-black.ant-btn-primary {
  background: #000 !important;
  border-color: #000 !important;
}

.um-modal-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.um-full {
  width: 100%;
}

.um-batch-hint {
  color: #999;
  font-size: 12px;
}

.um-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 6px;
}

.um-result-scroll {
  max-height: 400px;
  overflow: auto;
}

.um-result-footer {
  display: flex;
  justify-content: flex-end;
}
</style>

<style>
.um-table-empty {
  padding: 48px 20px;
  color: #999;
  text-align: center;
}

.um-table-empty__icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.um-table-empty__title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 6px;
}

.um-table-empty__sub {
  font-size: 13px;
}

.um-expires-never {
  color: #aaa;
}

.um-expires-bad {
  color: #ff4d4f;
}

.um-expires-ok {
  color: #52c41a;
}
</style>
