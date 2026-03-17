import { useState, useCallback } from "react";

interface UsePromptActionsProps {
  userRequirement: string;
  systemTemplate: string;
  onShowPreview: () => void;
}

export function usePromptActions({ userRequirement, systemTemplate, onShowPreview }: UsePromptActionsProps) {
  const [copySuccess, setCopySuccess] = useState<boolean | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState(false);

  const generateFullPrompt = useCallback((): string => {
    if (!userRequirement.trim()) return systemTemplate;
    return `${systemTemplate}\n\n---\n\n# 用户具体需求\n\n${userRequirement.trim()}`;
  }, [userRequirement, systemTemplate]);

  const handleCopy = useCallback(async () => {
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
      setCopySuccess(true);
      setCopyMessage("已复制到剪贴板！");
      setCopyError(false);
      setTimeout(() => { setCopySuccess(null); setCopyMessage(""); }, 3000);
    } catch {
      setCopySuccess(false);
      setCopyMessage("当前环境无法自动复制，请在下方预览区手动复制");
      setCopyError(true);
      onShowPreview();
    }
  }, [generateFullPrompt, onShowPreview]);

  const clearStatus = useCallback(() => {
    setCopySuccess(null);
    setCopyMessage("");
    setCopyError(false);
  }, []);

  return { copySuccess, copyMessage, copyError, generateFullPrompt, handleCopy, clearStatus };
}
