<template>
  <div
    class="app-card"
    :class="{
      'app-card--hover': hovered,
      'app-card--clickable': isRunning,
    }"
    @click="handleCardClick"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <!-- 复制链接（仅 running） -->
    <button v-if="isRunning" type="button" class="app-card__copy" @click="handleCopy">
      🔗 复制链接
    </button>

    <!-- 图标 -->
    <div class="app-card__icon">
      {{ icon }}
    </div>

    <!-- 名称 + 状态 -->
    <div class="app-card__title-row">
      <h3 class="app-card__name">
        {{ app.name }}
      </h3>
      <span class="app-card__status-wrap">
        <span class="app-card__dot" :style="dotStyle" />
        <span class="app-card__status-text">{{ statusText }}</span>
      </span>
    </div>

    <!-- 描述（strip markdown） -->
    <p v-if="app.description" class="app-card__desc">
      {{ stripMarkdown(app.description) }}
    </p>

    <!-- 元信息 -->
    <div class="app-card__meta">
      <div class="app-card__meta-row">
        <span class="app-card__meta-label">作者</span>
        <span class="app-card__meta-value">{{ app.owner.username }}</span>
      </div>
      <div class="app-card__meta-row">
        <span class="app-card__meta-label">工具最近更新时间</span>
        <span class="app-card__meta-value">{{ dayjs(app.updated_at).format('YYYY-MM-DD HH:mm') }}</span>
      </div>
    </div>

    <!-- 底部：三点菜单（ADropdown 须用 #overlay + a-menu，:menu 属性当前实现不会作为浮层渲染） -->
    <div class="app-card__footer" @click.stop>
      <a-dropdown :trigger="isActing ? [] : ['click']" placement="bottomRight">
        <template #overlay>
          <a-menu :items="menuItems" />
        </template>
        <button
          type="button"
          class="app-card__menu-btn"
          :class="{ 'app-card__menu-btn--acting': isActing }"
          @click.stop
        >
          {{ isActing ? '…' : '···' }}
        </button>
      </a-dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed, h, ref } from "vue";
import { message, Modal } from "ant-design-vue";
import dayjs from "dayjs";
import client from "@/api/client";
import { buildRunningAppUrl } from "@/utils/runningAppUrl";

const props = defineProps({
  app: { type: Object, required: true },
  canManage: { type: Boolean, required: true },
  isAdmin: { type: Boolean, required: true },
  isActing: { type: Boolean, required: true },
  onStop: { type: Function, required: true },
  onRestart: { type: Function, required: true },
  onDelete: { type: Function, required: true },
  onDetail: { type: Function, required: true },
  onUpdate: { type: Function, required: true },
  onEdit: { type: Function, required: true },
  username: { type: String, default: "" },
});

const hovered = ref(false);

const STATUS_DOT = {
  pending: { color: "#d0d0d0", text: "待上传", tagColor: "default" },
  building: { color: "#f59e0b", text: "构建中", tagColor: "processing" },
  running: { color: "#22c55e", text: "运行中", tagColor: "success" },
  stopped: { color: "#9ca3af", text: "已停止", tagColor: "warning" },
  failed: { color: "#ef4444", text: "构建失败", tagColor: "error" },
};

const APP_ICONS = ["📊", "🎨", "🔧", "📝", "🎯", "🔍", "💡", "🚀", "⚡", "🛠"];

const isRunning = computed(() => props.app.status === "running");
const icon = computed(() => APP_ICONS[props.app.id % APP_ICONS.length]);

const statusColor = computed(() => (STATUS_DOT[props.app.status]?.color ? STATUS_DOT[props.app.status].color : "#d0d0d0"));
const statusText = computed(() => (STATUS_DOT[props.app.status]?.text ? STATUS_DOT[props.app.status].text : props.app.status));

const dotStyle = computed(() => ({
  background: statusColor.value,
  boxShadow: isRunning.value ? `0 0 6px ${statusColor.value}` : "none",
}));

const stripMarkdown = (text) => {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*>\s]+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
};

const fallbackCopy = (text) => {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  if (ok) message.success("链接已复制");
  else message.error("复制失败，请手动复制：" + text);
};

const handleCopy = (e) => {
  e.stopPropagation();
  let url = "";
  if (props.app.status === "running" && props.app.host_port && props.app.access_url) {
    url = buildRunningAppUrl(props.app, props.username || "");
    if (!url) {
      message.warning("无法复制访问链接：缺少映射端口，请刷新列表后重试");
      return;
    }
  } else if (props.app.access_url) {
    url = window.location.origin + props.app.access_url;
  }
  if (!url) return;
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(url)
      .then(() => message.success("链接已复制"))
      .catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
};

const handleCardClick = () => {
  if (isRunning.value && props.app.access_url) {
    const uname = props.username || "";
    const url = buildRunningAppUrl(props.app, uname);
    if (!url) {
      message.warning("无法打开：缺少映射端口，请刷新列表后重试");
      return;
    }
    client.post(`/apps/internal/view/${props.app.id}`, { username: uname }).catch(() => {});
    window.open(url, "_blank");
  }
};

const menuItems = computed(() => {
  const items = [
    {
      key: "detail",
      label: "查看详情",
      disabled: props.isActing,
      onClick: (info) => {
        info?.domEvent?.stopPropagation();
        props.onDetail();
      },
    },
  ];

  if (props.isAdmin) {
    items.push({
      key: "edit",
      label: "编辑信息",
      disabled: props.isActing,
      onClick: (info) => {
        info?.domEvent?.stopPropagation();
        props.onEdit();
      },
    });
  }

  if (props.canManage) {
    items.push({
      key: "update",
      label: "更新应用",
      disabled: props.isActing,
      onClick: (info) => {
        info?.domEvent?.stopPropagation();
        props.onUpdate();
      },
    });
  }

  if (props.canManage && isRunning.value) {
    items.push({
      key: "stop",
      label: "停止应用",
      disabled: props.isActing,
      onClick: (info) => {
        info?.domEvent?.stopPropagation();
        props.onStop();
      },
    });
  }

  if (props.canManage && props.app.status === "stopped") {
    items.push({
      key: "restart",
      label: "启动应用",
      disabled: props.isActing,
      onClick: (info) => {
        info?.domEvent?.stopPropagation();
        props.onRestart();
      },
    });
  }

  if (props.canManage) {
    items.push({ type: "divider" });
    items.push({
      key: "delete",
      label: h(
        "span",
        {
          /* 菜单在 Portal 中渲染，不用 scoped class */
          style: { color: props.isActing ? "#ccc" : "#ef4444" },
        },
        "删除应用"
      ),
      disabled: props.isActing,
      onClick: (info) => {
        info?.domEvent?.stopPropagation();
        Modal.confirm({
          title: "确认删除该应用？",
          content: "删除后无法恢复",
          okText: "删除",
          okButtonProps: { danger: true },
          onOk: props.onDelete,
        });
      },
    });
  }

  return items;
});
</script>

<style scoped>
.app-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 24px;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
}

.app-card--clickable {
  cursor: pointer;
}

.app-card--hover {
  border-color: #d0d0d0;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.app-card__copy {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 3px 10px;
  background: #f5f5f5;
  color: #555;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s, border-color 0.15s;
}

.app-card__copy:hover {
  background: #ebebeb;
  border-color: #d0d0d0;
}

.app-card__icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2c2c2c, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 16px;
}

.app-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.app-card__name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: -0.3px;
  margin: 0;
  padding-right: 8px;
}

.app-card__status-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.app-card__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.app-card__status-text {
  font-size: 12px;
  color: #999;
}

.app-card__desc {
  font-size: 13px;
  color: #666;
  margin: 0 0 10px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.5;
}

.app-card__meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.app-card__meta-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.app-card__meta-label {
  color: #999;
  min-width: 44px;
}

.app-card__meta-value {
  color: #1a1a1a;
  font-weight: 500;
}

.app-card__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.app-card__menu-btn {
  padding: 4px 12px;
  background: transparent;
  color: #aaa;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  letter-spacing: 1px;
  transition: border-color 0.15s, color 0.15s;
}

.app-card__menu-btn:not(.app-card__menu-btn--acting):hover {
  border-color: #c0c0c0;
  color: #555;
}

.app-card__menu-btn--acting {
  color: #ddd;
  border-color: #f0f0f0;
  cursor: not-allowed;
}
</style>

