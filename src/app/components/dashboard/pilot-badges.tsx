import { useEffect, useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useNotifications } from "../../context/notifications-context";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface PilotBadgeItem {
  id: string;
  title: string;
  description: string;
  iconUrl?: string | null;
  icon?: string | null;
  color?: string | null;
  awardedAt?: string | null;
  source?: string;
}

interface PilotBadgesResponse {
  badges?: PilotBadgeItem[];
  newlyAwarded?: string[];
  error?: string;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function PilotBadges() {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [badges, setBadges] = useState<PilotBadgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadBadges = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/pilot/badges", { credentials: "include" });
        const payload = (await response.json().catch(() => null)) as PilotBadgesResponse | null;

        if (!active) {
          return;
        }

        if (!response.ok) {
          setBadges([]);
          setMessage(String(payload?.error || "Failed to load pilot badges."));
          return;
        }

        const nextBadges = Array.isArray(payload?.badges) ? payload.badges : [];
        setBadges(nextBadges);
        setMessage("");

        const newlyAwardedIds = new Set(Array.isArray(payload?.newlyAwarded) ? payload.newlyAwarded : []);
        nextBadges
          .filter((item) => newlyAwardedIds.has(item.id))
          .forEach((item) => {
            addNotification({
              category: "badge",
              title: t("badges.notificationTitle"),
              description: item.title,
            });
          });
      } catch {
        if (active) {
          setBadges([]);
          setMessage("Failed to load pilot badges.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadBadges();
    return () => {
      active = false;
    };
  }, [addNotification, t]);

  useEffect(() => {
    if (!message) {
      return;
    }
    toast.error(message);
  }, [message]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("badges.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("badges.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("badges.loading")}
        </div>
      ) : badges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <Award className="h-7 w-7" />
          </div>
          <div className="font-semibold text-[#1d1d1f]">{t("badges.empty")}</div>
          <div className="mt-1 text-sm text-gray-500">{t("badges.emptyDesc")}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {badges.map((badge) => (
            <Card key={badge.id} className="border-none shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-white shadow-sm"
                    style={{ backgroundColor: badge.color || "#E31E24" }}
                  >
                    {badge.iconUrl ? (
                      <img src={badge.iconUrl} alt={badge.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold uppercase">{String(badge.icon || badge.title || badge.id).slice(0, 3)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-xl text-[#1d1d1f]">{badge.title}</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6 text-gray-600">
                      {badge.description || "—"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 pt-0 text-sm text-gray-500">
                <div>
                  {t("badges.earnedAt")}: {formatDateTime(badge.awardedAt)}
                </div>
                <Badge variant="outline" className="bg-white">
                  {badge.source === "operations" ? "vAMSYS" : "Nordwind"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}