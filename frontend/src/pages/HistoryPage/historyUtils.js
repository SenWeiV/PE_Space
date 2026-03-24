export const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const CATEGORY_STYLE = {
  result: { color: "green", label: "结果" },
  detail: { color: "blue", label: "明细" },
  output: { color: "cyan", label: "产出" },
  download: { color: "purple", label: "下载" },
};

/** 操作类型样式 */
export const SUMMARY_TYPE_STYLE = {
  上传: { color: "#52c41a", bg: "#f6ffed", border: "#b7eb8f" },
  部署: { color: "#1677ff", bg: "#e6f4ff", border: "#91caff" },
  停止: { color: "#faad14", bg: "#fffbe6", border: "#ffe58f" },
  重启: { color: "#13c2c2", bg: "#e6fffb", border: "#87e8de" },
  更新: { color: "#722ed1", bg: "#f9f0ff", border: "#d3adf7" },
  删除: { color: "#ff4d4f", bg: "#fff2f0", border: "#ffccc7" },
  管理: { color: "#595959", bg: "#fafafa", border: "#d9d9d9" },
  访问: { color: "#1677ff", bg: "#e6f4ff", border: "#91caff" },
  下载: { color: "#52c41a", bg: "#f6ffed", border: "#b7eb8f" },
  其他: { color: "#8c8c8c", bg: "#fafafa", border: "#d9d9d9" },
};

export const getVisibleFiles = (record) => {
  const files = record.files || [];
  if (files.length === 0) return [];

  const resultFiles = files.filter((f) => f.category === "result");
  const detailFiles = files.filter((f) => f.category === "detail");
  const outputFiles = files.filter((f) => f.category === "output");
  const downloadFiles = files.filter((f) => f.category === "download");

  const allFile = detailFiles.find((f) => (f.name || "").includes("_all"));
  const shownDetail = allFile ? [allFile] : detailFiles;
  return [...resultFiles, ...shownDetail, ...outputFiles, ...downloadFiles];
};

/** 将 history JSON 中的 inputs 格式化为短文案（用于列表展示） */
export const formatInputsPreview = (inputs) => {
  if (inputs == null) return "";
  if (typeof inputs === "string") return inputs.trim();
  if (typeof inputs !== "object") return String(inputs);
  const entries = Object.entries(inputs).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      const short = val.length > 48 ? `${val.slice(0, 48)}…` : val;
      return `${k}: ${short}`;
    })
    .join(" · ");
};
