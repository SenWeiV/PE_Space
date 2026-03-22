<template>
  <div class="login-page">
    <LoginHero />
    <LoginFormPanel
      v-model:username="username"
      v-model:password="password"
      :loading="loading"
      :error="error"
      @submit="handleLogin"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "@/api/auth";
import LoginHero from "./LoginHero.vue";
import LoginFormPanel from "./LoginFormPanel.vue";

const router = useRouter();

const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const handleLogin = async () => {
  loading.value = true;
  error.value = "";
  try {
    const res = await login(username.value, password.value);
    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    router.push("/");
  } catch (e) {
    error.value = e?.response?.data?.detail || "用户名或密码错误";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
}
</style>
