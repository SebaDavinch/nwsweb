import { Radio, ArrowDownToLine, ArrowUpFromLine, Inbox, Wrench } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useActiveBooking } from "./use-active-booking";

/**
 * Каркас раздела ACARS в приложении. Статус подключения пока не реализуем
 * (по решению) — заложена структура: текущий рейс, входящие/исходящие, лог.
 */
export function AcarsPanel() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { booking } = useActiveBooking();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-red-500" />
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">ACARS</h1>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          {tr("в разработке", "in development")}
        </span>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {tr(
          "Передача сообщений ACARS (Hoppie/диспетчер ВАК) прямо из приложения. Раздел в активной разработке.",
          "ACARS messaging (Hoppie / VA dispatch) right from the app. This section is in active development."
        )}
      </p>

      {/* Текущий рейс */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{tr("Текущий рейс", "Current flight")}</div>
        {booking ? (
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {booking.callsign} · {booking.departureCode} → {booking.arrivalCode}
          </div>
        ) : (
          <div className="text-sm text-zinc-400">{tr("Нет активной брони", "No active booking")}</div>
        )}
      </div>

      {/* Заготовки входящих/исходящих */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { icon: <ArrowDownToLine className="h-4 w-4" />, label: tr("Входящие", "Inbox") },
          { icon: <ArrowUpFromLine className="h-4 w-4" />, label: tr("Исходящие", "Outbox") },
        ].map((b) => (
          <div key={b.label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              <span className="text-red-500">{b.icon}</span>
              {b.label}
            </div>
            <div className="flex flex-col items-center gap-1.5 py-6 text-center">
              <Inbox className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
              <span className="text-xs text-zinc-400">{tr("Сообщений пока нет", "No messages yet")}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
        <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {tr(
            "Полноценный ACARS-клиент (Hoppie CPDLC, телекс, погода) появится в одном из ближайших обновлений.",
            "A full ACARS client (Hoppie CPDLC, telex, weather) is coming in an upcoming update."
          )}
        </span>
      </div>
    </div>
  );
}
