<template>
  <div class="login-page__hero">
    <div class="login-page__brand">
      <div class="login-page__logo">AS</div>
      <div>
        <div class="login-page__brand-title">APP STORE</div>
        <div class="login-page__brand-sub">内部 AI 工具平台</div>
      </div>
    </div>
    <div class="login-page__intro">
      <h1 class="login-page__headline">
        把想法变成<br />
        可用的工具
      </h1>
      <p class="login-page__lead">
        描述需求，AI 自动生成代码并部署。<br />
        首次使用需要先安装开发环境。
      </p>
    </div>
    <div>
      <div class="login-page__install-label">一键安装开发环境</div>
      <div class="login-page__install-box">
        <code class="login-page__install-cmd">
          {{ INSTALL_CMD }}
        </code>
        <button type="button" class="login-page__copy-btn" @click="handleCopy">复制</button>
      </div>
      <p class="login-page__install-hint">在 Mac 终端运行，自动安装 Codex / OpenClaw / pe CLI</p>
    </div>
  </div>
</template>

<script setup>
const INSTALL_CMD = `curl -fsSL http://10.104.29.28/install.sh | bash`;

const handleCopy = async () => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(INSTALL_CMD);
    } else {
      const el = document.createElement("textarea");
      el.value = INSTALL_CMD;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  } catch {
    // ignore
  }
};
</script>

<style scoped>
.login-page__hero {
  width: 50%;
  background: #111;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px 64px;
}

.login-page__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 48px;
}

.login-page__logo {
  width: 44px;
  height: 44px;
  background: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #111;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}

.login-page__brand-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
}

.login-page__brand-sub {
  font-size: 12px;
  color: #555;
  margin-top: 1px;
}

.login-page__intro {
  margin-bottom: 48px;
}

.login-page__headline {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -1px;
  margin: 0 0 12px;
  line-height: 1.2;
}

.login-page__lead {
  font-size: 14px;
  color: #555;
  margin: 0;
  line-height: 1.7;
}

.login-page__install-label {
  font-size: 12px;
  color: #444;
  margin-bottom: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.login-page__install-box {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.login-page__install-cmd {
  font-size: 13px;
  color: #a3e635;
  font-family: "SF Mono", "Fira Code", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.login-page__copy-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  background: #2a2a2a;
  color: #888;
  border: 1px solid #333;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.login-page__copy-btn:hover {
  background: #333;
  color: #aaa;
}

.login-page__install-hint {
  font-size: 12px;
  color: #333;
  margin: 10px 0 0;
}
</style>
