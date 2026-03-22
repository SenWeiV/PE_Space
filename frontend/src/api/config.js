import client from "./client";

export const getTemplate = () =>
  client.get("/config/template");

export const updateTemplate = (value) => client.put("/config/template", { value });

export const getTemplateHistory = () =>
  client.get("/config/template/history");

export const getIntegrationSettings = () => client.get("/config/integration");

export const updateIntegrationSettings = (body) =>
  client.put("/config/integration", body);

export const getIpAllowlist = () => client.get("/config/ip-allowlist");

export const updateIpAllowlist = (value) =>
  client.put("/config/ip-allowlist", { value });
