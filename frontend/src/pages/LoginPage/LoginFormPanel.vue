<template>
  <div class="login-page__panel">
    <div class="login-page__form-wrap">
      <div class="login-page__form-header">
        <h2 class="login-page__form-title">欢迎登录</h2>
        <p class="login-page__form-desc">账号格式：姓名全拼 &nbsp;·&nbsp; 密码：全拼 + 123</p>
      </div>

      <div v-if="error" class="login-page__error">
        {{ error }}
      </div>

      <form @submit.prevent="emit('submit')">
        <label class="login-page__label">用户名</label>
        <input
          :value="username"
          class="login-page__input"
          placeholder="请输入用户名"
          @input="emit('update:username', $event.target.value)"
        />

        <label class="login-page__label">密码</label>
        <input
          :value="password"
          class="login-page__input login-page__input--last"
          type="password"
          placeholder="请输入密码"
          @input="emit('update:password', $event.target.value)"
        />

        <button
          type="submit"
          :disabled="loading"
          class="login-page__submit"
          :class="{ 'login-page__submit--loading': loading }"
        >
          {{ loading ? "登录中..." : "登录" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
defineProps({
  username: { type: String, required: true },
  password: { type: String, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, required: true },
});

const emit = defineEmits(["update:username", "update:password", "submit"]);
</script>

<style scoped>
.login-page__panel {
  width: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 64px;
}

.login-page__form-wrap {
  width: 100%;
  max-width: 360px;
}

.login-page__form-header {
  margin-bottom: 36px;
}

.login-page__form-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 6px;
}

.login-page__form-desc {
  font-size: 13px;
  color: #999;
  margin: 0;
}

.login-page__error {
  background: #fff1f0;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #ef4444;
  margin-bottom: 20px;
}

.login-page__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.login-page__input {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
  font-size: 14px;
  padding: 12px 14px;
  margin-bottom: 16px;
  box-sizing: border-box;
}

.login-page__input--last {
  margin-bottom: 28px;
}

.login-page__submit {
  width: 100%;
  padding: 13px 0;
  background: #1a1a1a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.login-page__submit:hover:not(:disabled) {
  background: #333;
}

.login-page__submit--loading,
.login-page__submit:disabled {
  background: #666;
  cursor: not-allowed;
}
</style>
