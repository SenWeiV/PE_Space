import client from "./client";

export interface ConfigOut {
  key: string;
  value: string;
  updated_by?: number;
  updater_name?: string;
  updated_at: string;
}

export interface ConfigHistoryOut {
  id: number;
  config_key: string;
  value: string;
  updater_name?: string;
  updated_at: string;
}

export const getTemplate = () =>
  client.get<ConfigOut>("/config/template");

export const updateTemplate = (value: string) =>
  client.put<ConfigOut>("/config/template", { value });

export const getTemplateHistory = () =>
  client.get<ConfigHistoryOut[]>("/config/template/history");
