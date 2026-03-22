import client from "./client";
export const listApps = (params) => client.get("/apps", { params });

export const getApp = (id) => client.get(`/apps/${id}`);

export const createApp = (data) => client.post("/apps", data);

export const uploadZip = (id, file) => {
  const blob = file?.originFileObj ?? file;
  const form = new FormData();
  form.append("file", blob);
  // 不要手动设置 multipart Content-Type，否则缺少 boundary 会导致服务端无法解析
  return client.post(`/apps/${id}/upload`, form);
};

export const deployApp = (id) => client.post(`/apps/${id}/deploy`);

export const stopApp = (id) => client.post(`/apps/${id}/stop`);

export const restartApp = (id) => client.post(`/apps/${id}/restart`);

export const deleteApp = (id) => client.delete(`/apps/${id}`);

export const updateAppInfo = (id, data) => client.patch(`/apps/${id}`, data);

export const getAppLogs = (id) => client.get(`/apps/${id}/logs`);

export const getAppHistory = (id) => client.get(`/apps/${id}/history`);

export const downloadOutput = async (appId, runId, filename) => {
  const res = await client.get(
    `/apps/${appId}/outputs/${encodeURIComponent(runId)}/${encodeURIComponent(filename)}`,
    { responseType: "blob" }
  );
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const listGroupedRuns = () => client.get("/apps/history/grouped");

export const downloadAppFile = async (appId, filePath, name) => {
  const res = await client.get(`/apps/${appId}/files/${filePath}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
