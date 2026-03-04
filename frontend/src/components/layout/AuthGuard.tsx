import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** 不允许标注账号访问（annotator 会被重定向到首页） */
  forbidAnnotator?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false, forbidAnnotator = false }: Props) {
  const { user, token } = useAuthStore();

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
