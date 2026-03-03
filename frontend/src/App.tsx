import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "@/components/layout/AuthGuard";
import MainLayout from "@/components/layout/MainLayout";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import AppsListPage from "@/pages/AppsListPage";
import AppDetailPage from "@/pages/AppDetailPage";
import UserManagePage from "@/pages/admin/UserManagePage";
import TemplateManagePage from "@/pages/admin/TemplateManagePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <AuthGuard>
              <MainLayout />
            </AuthGuard>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="apps" element={<AppsListPage />} />
          <Route path="apps/:appId" element={<AppDetailPage />} />

          {/* 管理员路由 - 只保留用户管理和系统模板管理 */}
          <Route
            path="admin/users"
            element={
              <AuthGuard requireAdmin>
                <UserManagePage />
              </AuthGuard>
            }
          />
          <Route
            path="admin/template"
            element={
              <AuthGuard requireAdmin>
                <TemplateManagePage />
              </AuthGuard>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
