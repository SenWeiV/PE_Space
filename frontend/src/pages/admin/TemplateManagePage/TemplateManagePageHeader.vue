<template>
  <div class="tmp-header">
    <h1 class="tmp-title">代码规范Prompt</h1>
    <p class="tmp-desc">
      管理首页使用的代码规范 Prompt。修改后将对所有用户立即生效。
      <a-tag color="red" class="tmp-tag-warn">仅管理员可操作</a-tag>
    </p>
  </div>
</template>

<style scoped>
.tmp-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}

.tmp-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 6px;
}

.tmp-desc {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.tmp-tag-warn {
  margin-left: 8px;
}
</style>
