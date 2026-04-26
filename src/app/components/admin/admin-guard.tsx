import { Navigate } from "react-router";
import { useAuth } from "../../context/auth-context";

export function AdminGuard({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isAuthLoading, isAdmin } = useAuth();

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
