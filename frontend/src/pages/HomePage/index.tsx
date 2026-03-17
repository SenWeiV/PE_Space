import { useState, useCallback, useEffect } from "react";
import { Row, Col, Alert } from "antd";
import { getTemplate } from "@/api/config";
import { DEFAULT_SYSTEM_PROMPT_TEMPLATE, EXAMPLE_REQUIREMENT } from "./constants";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { usePromptActions } from "./usePromptActions";
import RulesPanel from "./RulesPanel";
import RequirementEditor from "./RequirementEditor";
import SpeechBar from "./SpeechBar";
import BottomBar from "./BottomBar";
import PromptPreviewModal from "./PromptPreviewModal";

export default function HomePage() {
  const [userRequirement, setUserRequirement] = useState(`工具名称：\n\n业务背景：\n\n输入：\n\n输出：`);
  const [systemTemplate, setSystemTemplate] = useState(DEFAULT_SYSTEM_PROMPT_TEMPLATE);
  const [showPreview, setShowPreview] = useState(false);
  const [speechErrorMsg, setSpeechErrorMsg] = useState("");

  useEffect(() => {
    getTemplate().then(res => setSystemTemplate(res.data.value)).catch(() => {});
  }, []);

  const speech = useSpeechRecognition({
    onTranscript: (text) => setUserRequirement(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text),
    onError: (msg) => setSpeechErrorMsg(msg),
  });

  const prompt = usePromptActions({
    userRequirement,
    systemTemplate,
    onShowPreview: () => setShowPreview(true),
  });

  const handleClear = useCallback(() => {
    setUserRequirement("");
    prompt.clearStatus();
  }, [prompt]);

  const handleFillExample = useCallback(() => {
    setUserRequirement(EXAMPLE_REQUIREMENT);
    prompt.clearStatus();
  }, [prompt]);

  return (
    <div style={{ padding: "0 0 100px", fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* 顶部标题区（sticky） */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fafafa",
        padding: "32px 0 20px",
        marginBottom: 8,
        borderBottom: "1px solid #f0f0f0",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px", margin: "0 0 12px" }}>
          AI Coding
        </h1>
        <style>{`
          @keyframes gradientBorder {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
        <div style={{
          display: "inline-flex",
          background: "linear-gradient(270deg, #6366f1, #a855f7, #3b82f6, #06b6d4, #10b981, #6366f1)",
          backgroundSize: "400% 400%",
          animation: "gradientBorder 4s ease infinite",
          borderRadius: 12,
          padding: 2,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 20px", background: "#111", borderRadius: 10,
          }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "0.2px" }}>
              在「需求」那填写你的需求，填完之后复制完整的提示词，放到 Comate 里然后一直点确定就好了
            </span>
          </div>
        </div>
      </div>

      {/* 提示消息 */}
      {prompt.copySuccess !== null && (
        <Alert
          message={prompt.copyMessage}
          type={prompt.copySuccess ? "success" : prompt.copyError ? "warning" : "info"}
          showIcon
          closable
          onClose={prompt.clearStatus}
          style={{ marginBottom: 20, borderRadius: 8, animation: 'slideDown 0.3s ease' }}
        />
      )}
      {speechErrorMsg && (
        <Alert
          message={speechErrorMsg}
          type="warning"
          showIcon
          closable
          onClose={() => setSpeechErrorMsg("")}
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {/* 语音录制状态条 */}
      {speech.isRecording && (
        <SpeechBar
          isPaused={speech.isPaused}
          onPause={speech.pause}
          onResume={speech.resume}
          onStop={speech.stop}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <RulesPanel systemTemplate={systemTemplate} />
        </Col>
        <Col xs={24} lg={12}>
          <RequirementEditor
            value={userRequirement}
            onChange={setUserRequirement}
            onClear={handleClear}
            onFillExample={handleFillExample}
            onStartRecording={speech.start}
            isRecording={speech.isRecording}
            isPaused={speech.isPaused}
            speechSupported={speech.speechSupported}
          />
        </Col>
      </Row>

      <BottomBar
        copySuccess={prompt.copySuccess}
        showPreview={showPreview}
        onCopy={prompt.handleCopy}
        onTogglePreview={() => setShowPreview(v => !v)}
      />

      <PromptPreviewModal
        open={showPreview}
        content={prompt.generateFullPrompt()}
        onClose={() => setShowPreview(false)}
        onCopy={prompt.handleCopy}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
