import { Navigate } from "react-router";
import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";

export function AdminGuard({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isAuthLoading, isAdmin } = useAuth();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">{tr("Загрузка...", "Loading...")}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
