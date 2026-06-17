import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useActiveBooking } from "./use-active-booking";
import { AppOfp } from "./app-ofp";
import { AppLogin } from "./app-login";

/** Режим «План полёта» (OFP) — верхний таб, доступен только при активной броне. */
export function OfpMode() {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { booking, loading } = useActiveBooking();

  if (isAuthLoading || loading) {
    return <div className="p-8 text-sm text-zinc-500">{t("app.loading")}</div>;
  }
  if (!isAuthenticated) {
    return <AppLogin />;
  }
  if (!booking) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-zinc-500 dark:text-zinc-400">
        <p className="text-sm">{tr("План полёта доступен при активном рейсе.", "The flight plan is available with an active flight.")}</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-100 p-5 dark:bg-zinc-950">
      <AppOfp bookingId={booking.id} route={`${booking.departureCode} → ${booking.arrivalCode}`} />
    </div>
  );
}
