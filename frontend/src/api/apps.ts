import client from "./client";
import type { User } from "./auth";

export interface AppItem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  status: "pending" | "building" | "running" | "stopped" | "failed";
  access_url?: string;
  host_port?: number;
  build_log?: string;
  owner: User;
  created_at: string;
  updated_at: string;
}

export interface AppListResponse {
  total: number;
  page: number;
  size: number;
  items: AppItem[];
}

export const listApps = (params?: { page?: number; size?: number; status?: string }) =>
  client.get<AppListResponse>("/apps", { params });

export const getApp = (id: number) => client.get<AppItem>(`/apps/${id}`);

export const createApp = (data: { name: string; slug: string; description?: string }) =>
  client.post<AppItem>("/apps", data);

export const uploadZip = (id: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client.post(`/apps/${id}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deployApp = (id: number) => client.post(`/apps/${id}/deploy`);

export const stopApp = (id: number) => client.post(`/apps/${id}/stop`);

export const restartApp = (id: number) => client.post(`/apps/${id}/restart`);

export const deleteApp = (id: number) => client.delete(`/apps/${id}`);

export const updateAppInfo = (id: number, data: { name?: string; description?: string; owner_id?: number }) =>
  client.patch<AppItem>(`/apps/${id}`, data);

export const getAppLogs = (id: number) =>
  client.get<{ app_id: number; status: string; log: string }>(`/apps/${id}/logs`);

export interface RunRecord {
  run_id: string;
  username: string;
  timestamp: string;
  inputs: Record<string, unknown>;
  output_path: string;
  output_filename: string;
  summary: string;
  app_version?: number;
}

export const getAppHistory = (id: number) =>
  client.get<RunRecord[]>(`/apps/${id}/history`);

export const downloadOutput = async (appId: number, runId: string, filename: string) => {
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

export interface AllRunRecord extends RunRecord {
  app_id: number;
  app_name: string;
  app_slug: string;
}

export const listAllRuns = () =>
  client.get<{ runs: AllRunRecord[] }>("/apps/history/runs");

export interface HistoryFile {
  app_id: number;
  app_name: string;
  app_slug: string;
  name: string;
  path: string;
  size: number;
  modified_at: string;
}

export const listAllFiles = () =>
  client.get<{ files: HistoryFile[] }>("/apps/history/files");

export interface GroupedRunFile {
  name: string;
  path: string;
  size: number;
  category: "result" | "detail" | "output";
}

export interface GroupedRun {
  ts_key: string;
  app_id: number;
  app_name: string;
  app_slug: string;
  timestamp: string;
  username: string;
  summary: string;
  files: GroupedRunFile[];
}

export const listGroupedRuns = () =>
  client.get<{ groups: GroupedRun[] }>("/apps/history/grouped");

export const downloadAppFile = async (appId: number, filePath: string, name: string) => {
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
