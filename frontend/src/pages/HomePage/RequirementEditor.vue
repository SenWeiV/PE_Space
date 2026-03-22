<template>
  <SectionCard :icon="CodeOutlined" title="我的需求">
    <template #extra>
      <a-space>
        <a-button
          v-if="!isRecording && speechSupported"
          size="small"
          class="re-btn-outline"
          @click="onStartRecording"
        >
          <template #icon>
            <SoundOutlined />
          </template>
          语音输入
        </a-button>
        <a-button size="small" @click="onClear">
          <template #icon>
            <ClearOutlined />
          </template>
          清空
        </a-button>
        <a-button size="small" type="primary" ghost class="re-btn-outline" @click="onFillExample">
          填入示例
        </a-button>
      </a-space>
    </template>

    <div class="re-snippets">
      <div class="re-snippets-label">快捷插入技术需求：</div>
      <a-space :size="6" wrap>
        <a-tag v-for="s in QUICK_SNIPPETS" :key="s.label" class="re-snippet-tag" @click="onChange(value + s.text)">
          {{ s.label }}
        </a-tag>
      </a-space>
    </div>

    <a-textarea
      :value="value"
      :rows="10"
      placeholder="请在此处描述你的具体需求..."
      class="re-textarea"
      :class="{ 're-textarea--filled': value.length > 0 }"
      @update:value="onChange"
    />

    <div class="re-footer">
      <a-space>
        <a-badge v-if="isRecording && !isPaused" status="processing">
          <template #text>
            <span class="re-listening">正在监听...</span>
          </template>
        </a-badge>

        <span class="re-hint">
          {{
            value.length === 0
              ? "开始输入你的需求"
              : value.length < 50
                ? "建议多写一些细节"
                : value.length < 500
                  ? "内容不错，继续完善"
                  : "内容很详细！"
          }}
        </span>
      </a-space>

      <a-space>
        <a-progress
          :percent="Math.min((value.length / 500) * 100, 100)"
          size="small"
          :strokeColor="getCharCountColor(value.length)"
          :showInfo="false"
          class="re-progress"
        />
        <span class="re-count" :class="countClass(value.length)"> {{ value.length }} 字 </span>
      </a-space>
    </div>
  </SectionCard>
</template>

<script setup>
import { ClearOutlined, SoundOutlined, CodeOutlined } from "@ant-design/icons-vue";
import { QUICK_SNIPPETS, theme } from "./constants";
import SectionCard from "./SectionCard.vue";

const { value, onChange, onClear, onFillExample, onStartRecording, isRecording, isPaused, speechSupported } = defineProps({
  value: { type: String, required: true },
  onChange: { type: Function, required: true },
  onClear: { type: Function, required: true },
  onFillExample: { type: Function, required: true },
  onStartRecording: { type: Function, required: true },
  isRecording: { type: Boolean, required: true },
  isPaused: { type: Boolean, required: true },
  speechSupported: { type: Boolean, required: true },
});

const getCharCountColor = (count) => {
  if (count === 0) return theme.textTertiary;
  if (count < 50) return theme.warning;
  if (count < 500) return theme.success;
  return "#000000";
};

const countClass = (len) => {
  if (len === 0) return "re-count--empty";
  if (len < 50) return "re-count--short";
  if (len < 500) return "re-count--ok";
  return "re-count--full";
};
</script>

<style scoped>
.re-btn-outline {
  border-color: #000000 !important;
  color: #000000 !important;
}
.re-snippets {
  margin-bottom: 12px;
}
.re-snippets-label {
  font-size: 12px;
  display: block;
  margin-bottom: 6px;
  color: #4e5969;
}
.re-snippet-tag {
  cursor: pointer;
  padding: 3px 12px;
  font-size: 13px;
  border-radius: 12px;
  user-select: none;
}
.re-textarea {
  font-size: 15px;
  line-height: 1.7;
  resize: vertical;
  min-height: 200px;
  border-radius: 8px;
  border-color: #e5e6eb;
}
.re-textarea--filled {
  border-color: #000000;
}
.re-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e6eb;
}
.re-listening {
  color: #00b42a;
}
.re-hint {
  font-size: 13px;
  color: #4e5969;
}
.re-progress {
  width: 60px;
}
.re-count {
  font-size: 14px;
  font-weight: 600;
}
.re-count--empty {
  color: #86909c;
}
.re-count--short {
  color: #ff7d00;
}
.re-count--ok {
  color: #00b42a;
}
.re-count--full {
  color: #000000;
}
</style>
