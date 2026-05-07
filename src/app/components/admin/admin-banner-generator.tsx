import { Component, Suspense, lazy, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";

const BannerGeneratorApp = lazy(() =>
  import("./banner-generator/App").catch((err) => {
    console.error("[BannerGenerator] Failed to load module:", err);
    throw err;
  })
);

class BannerErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <div className="font-semibold mb-1">Ошибка загрузки генератора баннеров</div>
          <pre className="text-xs text-red-700 whitespace-pre-wrap">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminBannerGeneratorPage() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <BannerErrorBoundary fallback={null}>
      <Suspense fallback={<div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{tr("Загрузка генератора баннеров...", "Loading banner generator...")}</div>}>
        <BannerGeneratorApp />
      </Suspense>
    </BannerErrorBoundary>
  );
}

export function BannerGeneratorStandalonePage() {
  const { language } = useLanguage();
  const { isAuthenticated, isAuthLoading, isAdmin } = useAuth();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        {tr("Доступ запрещён", "Access denied")}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-4 shadow-sm">
        <Link
          to="/admin?page=dashboard"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr("Консоль управления", "Admin Console")}
        </Link>
        <h1 className="text-sm font-semibold text-gray-800">
          {tr("Генератор баннеров", "Banner Generator")}
        </h1>
      </header>
      <main className="flex-1">
        <AdminBannerGeneratorPage />
      </main>
    </div>
  );
}
