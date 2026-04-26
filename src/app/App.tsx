import { RouterProvider } from 'react-router';
import { router } from './routes';
import { LanguageProvider } from "./context/language-context";
import { AuthProvider } from "./context/auth-context";
import { NewsProvider } from "./context/news-context";
import { NotificationsProvider } from "./context/notifications-context";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NewsProvider>
          <NotificationsProvider>
            <RouterProvider router={router} />
            <Toaster richColors closeButton position="top-right" />
          </NotificationsProvider>
        </NewsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}