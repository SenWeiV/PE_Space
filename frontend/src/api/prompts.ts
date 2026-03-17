import client from "./client";

export interface Prompt {
  id: number;
  title: string;
  content: string;
  category?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export const listPrompts = (category?: string) =>
  client.get<Prompt[]>("/prompts", { params: category ? { category } : undefined });

export const listCategories = () => client.get<string[]>("/prompts/categories");

export const createPrompt = (data: Omit<Prompt, "id" | "is_active" | "created_at">) =>
  client.post<Prompt>("/prompts", data);

export const updatePrompt = (id: number, data: Partial<Prompt>) =>
  client.put<Prompt>(`/prompts/${id}`, data);

export const deletePrompt = (id: number) => client.delete(`/prompts/${id}`);
