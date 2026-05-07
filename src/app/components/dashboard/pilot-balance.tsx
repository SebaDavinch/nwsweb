import { useEffect, useState } from "react";
import { Coins, Heart, Plane, Star, ShoppingBag, Loader2, TrendingUp } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface BalanceTransaction {
  id: string;
  label: string;
  amount: number;
  icon: "plane" | "heart" | "star" | "event";
  detail?: string;
}

interface BalancePayload {
  balance: number;
  currency: string;
  breakdown: BalanceTransaction[];
}

const ICON_MAP: Record<string, typeof Coins> = {
  plane: Plane,
  heart: Heart,
  star: Star,
  event: TrendingUp,
};

export function PilotBalance() {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [data, setData] = useState<BalancePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/pilot/balance", { credentials: "include" });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload) setData(payload);
      } catch { /* ignore */ } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {tr("Загружаем баланс...", "Loading balance...")}
      </div>
    );
  }

  const balance = data?.balance ?? 0;
  const breakdown = data?.breakdown ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">{tr("Баланс", "Balance")}</h1>
        <p className="text-sm text-gray-500">{tr("Монетки считаются только по принятым PIREP: отдельно за каждый рейс, по качеству посадки, суточному бонусу, лайкам и участию в ивентах.", "Coins are counted only from accepted PIREPs: per flight, by landing quality, daily bonus, likes and event participation.")}</p>
      </div>

      {/* Main balance card */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d1d1f] to-[#2f2f34] p-8 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-widest text-white/50">{tr("Доступный баланс", "Available balance")}</div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-6xl font-bold tabular-nums">{balance.toLocaleString("ru-RU")}</span>
              <span className="mb-2 text-2xl text-white/60">⭐</span>
            </div>
            <div className="mt-2 text-sm text-white/50">{tr("монеток", "coins")}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <Coins className="h-8 w-8 text-amber-400" />
          </div>
        </div>
      </div>

      {/* How to earn */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{tr("Как зарабатывать", "How to earn")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: Plane, label: tr("За мили", "For miles"), amount: "+0.5 / 5 NM", desc: tr("0.1 монеты за каждую морскую милю, только по принятому отдельному PIREP", "0.1 coin for each nautical mile, only for each accepted PIREP") },
            { icon: Star, label: tr("Посадка", "Landing"), amount: tr("-0.2..+1", "-0.2..+1"), desc: tr("штраф или бонус зависят от вертикальной скорости и G-force", "penalty or bonus depends on vertical speed and G-force") },
            { icon: Coins, label: tr("Ежедневный бонус", "Daily bonus"), amount: "+5", desc: tr("за каждый день, в котором есть хотя бы один принятый PIREP", "for each day with at least one accepted PIREP") },
            { icon: Heart, label: tr("За лайки", "For likes"), amount: "+1", desc: tr("за каждый лайк под фото, максимум 5 в сутки", "per screenshot like, capped at 5 per day") },
            { icon: TrendingUp, label: tr("За ивенты", "For events"), amount: tr("фикс / xN", "fixed / xN"), desc: tr("для каждого ивента можно задать фикс, множитель, лимит и требование регистрации", "each event can define fixed reward, multiplier, limit and registration dependency") },
          ].map(({ icon: Icon, label, amount, desc }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-[#E31E24]" />
                <span className="text-lg font-bold text-emerald-600">{amount}</span>
              </div>
              <div className="mt-2 text-sm font-medium text-gray-900">{label}</div>
              <div className="mt-0.5 text-xs text-gray-500">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      {breakdown.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{tr("Начислено", "Earned")}</h2>
          <div className="space-y-3">
            {breakdown.map((tx) => {
              const Icon = ICON_MAP[tx.icon] || Coins;
              const isPositive = tx.amount >= 0;
              return (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white p-2 shadow-sm">
                      <Icon className="h-4 w-4 text-[#E31E24]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{tx.label}</div>
                      {tx.detail && <div className="text-xs text-gray-500">{tx.detail}</div>}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                    {isPositive ? "+" : "-"}{Math.abs(tx.amount).toLocaleString("ru-RU")} ⭐
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shop teaser */}
      <div className="overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <div className="text-base font-semibold text-gray-500">{tr("Магазин — скоро", "Shop — coming soon")}</div>
        <p className="mt-2 text-sm text-gray-400">
          {tr("Здесь вы сможете обменять монетки на скидки на аддоны, ливреи и другие бонусы.", "Here you'll be able to exchange coins for addon discounts, liveries and other bonuses.")}
        </p>
      </div>
    </div>
  );
}
