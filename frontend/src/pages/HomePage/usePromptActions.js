import { computed, ref, unref } from "vue";

export function usePromptActions({ userRequirement, systemTemplate, onShowPreview }) {
  const copySuccess = ref(null);
  const copyMessage = ref("");
  const copyError = ref(false);

  const requirement = computed(() => unref(userRequirement));
  const template = computed(() => unref(systemTemplate));

  const generateFullPrompt = () => {
    if (!requirement.value.trim()) return template.value;
    return `${template.value}\n\n---\n\n# 用户具体需求\n\n${requirement.value.trim()}`;
  };

  const handleCopy = async () => {
    try {
      const fullPrompt = generateFullPrompt();
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullPrompt);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = fullPrompt;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!successful) throw new Error("Copy failed");
      }

      copySuccess.value = true;
      copyMessage.value = "已复制到剪贴板！";
      copyError.value = false;
      setTimeout(() => {
        copySuccess.value = null;
        copyMessage.value = "";
      }, 3000);
    } catch {
      copySuccess.value = false;
      copyMessage.value = "当前环境无法自动复制，请在下方预览区手动复制";
      copyError.value = true;
      onShowPreview();
    }
  };

  const clearStatus = () => {
    copySuccess.value = null;
    copyMessage.value = "";
    copyError.value = false;
  };

  return {
    copySuccess,
    copyMessage,
    copyError,
    generateFullPrompt,
    handleCopy,
    clearStatus,
  };
}

