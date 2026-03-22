<template>
  <div class="home-page__sticky">
    <h1 class="home-page__title">AI Coding</h1>

    <div class="home-page__gradient-wrap">
      <div class="home-page__tip-inner">
        <span class="home-page__tip-emoji">💡</span>
        <span class="home-page__tip-text">
          在「需求」那填写你的需求，填完之后复制完整的提示词，放到 Comate 里然后一直点确定就好了
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page__sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  padding: 32px 0 20px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.home-page__title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
  margin: 0 0 12px;
}

.home-page__gradient-wrap {
  display: inline-flex;
  background: linear-gradient(
    270deg,
    #6366f1,
    #a855f7,
    #3b82f6,
    #06b6d4,
    #10b981,
    #6366f1
  );
  background-size: 400% 400%;
  animation: gradientBorder 4s ease infinite;
  border-radius: 12px;
  padding: 2px;
}

.home-page__tip-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 20px;
  background: #111;
  border-radius: 10px;
}

.home-page__tip-emoji {
  font-size: 20px;
}

.home-page__tip-text {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.2px;
}

@keyframes gradientBorder {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
