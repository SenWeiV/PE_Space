<template>
  <a-card :bordered="bordered" :body-style="bodyStyle" class="hp-sc-card">
    <template #title>
      <a-space :size="10">
        <div class="hp-sc-icon-wrap">
          <component :is="icon" class="hp-sc-icon" />
        </div>
        <span class="hp-sc-title">{{ title }}</span>
      </a-space>
    </template>
    <template v-if="$slots.extra" #extra>
      <slot name="extra" />
    </template>
    <slot />
  </a-card>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  bordered: { type: Boolean, default: true },
  bodyStyle: { type: Object, default: undefined },
});
</script>

<style scoped>
.hp-sc-card {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e6eb;
  overflow: hidden;
}
.hp-sc-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hp-sc-icon {
  font-size: 16px;
  color: #000000;
}
.hp-sc-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
}
</style>
