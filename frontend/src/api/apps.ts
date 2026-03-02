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

export const getAppLogs = (id: number) =>
  client.get<{ app_id: number; status: string; log: string }>(`/apps/${id}/logs`);
