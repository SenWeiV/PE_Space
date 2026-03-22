export const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const CATEGORY_STYLE = {
  result: { color: "green", label: "结果" },
  detail: { color: "blue", label: "明细" },
  output: { color: "default", label: "产出" },
};

export const getVisibleFiles = (record) => {
  const resultFiles = (record.files || []).filter((f) => f.category === "result");
  const detailFiles = (record.files || []).filter((f) => f.category === "detail");
  const outputFiles = (record.files || []).filter((f) => f.category === "output");

  const allFile = detailFiles.find((f) => (f.name || "").includes("_all"));
  const shownDetail = allFile ? [allFile] : detailFiles;
  return [...resultFiles, ...shownDetail, ...outputFiles];
};
