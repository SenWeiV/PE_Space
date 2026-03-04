import client from "./client";

export interface User {
  id: number;
  username: string;
  email?: string;
  role: "user" | "admin" | "annotator";
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export const login = (username: string, password: string) =>
  client.post<LoginResponse>("/auth/login", { username, password });

export const getMe = () => client.get<User>("/auth/me");
