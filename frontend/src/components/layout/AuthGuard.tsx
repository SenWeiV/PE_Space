import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import client from "@/api/client";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** 不允许标注账号访问（annotator 会被重定向到首页） */
  forbidAnnotator?: boolean;
}

/** 心跳间隔（毫秒）：定期检测登录互踢 */
const HEARTBEAT_MS = 30_000;

export default function AuthGuard({ children, requireAdmin = false, forbidAnnotator = false }: Props) {
  const { user, token } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    const check = () => {
      client.get("/auth/me").catch(() => {
        // 409 互踢由 client.ts 拦截器统一处理（弹窗 + 跳登录页）
      });
    };

    timerRef.current = setInterval(check, HEARTBEAT_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token]);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (forbidAnnotator && user.role === "annotator") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
