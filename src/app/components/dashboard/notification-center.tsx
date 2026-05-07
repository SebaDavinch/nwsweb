import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  BellRing,
  BookMarked,
  Check,
  CheckCheck,
  ClipboardCheck,
  MessageSquareWarning,
  ShieldAlert,
  Siren,
  Trash2,
  Trophy,
} from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { useNotifications, type NotificationCategory, type NotificationItem } from "../../context/notifications-context";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";

const CATEGORY_META: Record<NotificationCategory, {
  labelKey: string;
  icon: typeof Bell;
  accentClass: string;
  badgeClass: string;
}> = {
  booking: {
    labelKey: "notifications.category.booking",
    icon: BookMarked,
    accentClass: "text-[#E31E24]",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
  },
  claim: {
    labelKey: "notifications.category.claim",
    icon: ClipboardCheck,
    accentClass: "text-sky-600",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  review: {
    labelKey: "notifications.category.review",
    icon: MessageSquareWarning,
    accentClass: "text-amber-600",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  reply: {
    labelKey: "notifications.category.reply",
    icon: Siren,
    accentClass: "text-orange-600",
    badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
  },
  notam: {
    labelKey: "notifications.category.notam",
    icon: ShieldAlert,
    accentClass: "text-orange-600",
    badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
  },
  event: {
    labelKey: "notifications.category.event",
    icon: Trophy,
    accentClass: "text-violet-600",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
  },
  badge: {
    labelKey: "notifications.category.badge",
    icon: Trophy,
    accentClass: "text-fuchsia-600",
    badgeClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  },
  system: {
    labelKey: "notifications.category.system",
    icon: BellRing,
    accentClass: "text-emerald-600",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

const formatNotificationTime = (value: string, locale: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface StaffTicketPreview {
  id: string;
  number: number;
  subject: string;
  status: string;
  unreadCount: number;
  updatedAt?: string;
}

const NotificationCard = ({
  item,
  onRead,
  onDelete,
  onAction,
  t,
  locale,
}: {
  item: NotificationItem;
  onRead: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  onAction: (item: NotificationItem) => void;
  t: (key: string) => string;
  locale: string;
}) => {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
  const Icon = meta.icon;

  return (
    <Card className={`border shadow-none transition-colors ${item.isRead ? "bg-white" : "border-red-100 bg-[#fff7f7]"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ${meta.accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="font-semibold text-[#1d1d1f]">{item.title}</div>
              <Badge variant="outline" className={meta.badgeClass}>
                {t(meta.labelKey)}
              </Badge>
              {!item.isRead ? <Badge className="bg-[#E31E24] text-white">{t("notifications.new")}</Badge> : null}
            </div>
            <p className="text-sm text-gray-600">{item.description}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-400">{formatNotificationTime(item.createdAt, locale)}</div>
              <div className="flex flex-wrap gap-2">
                {!item.isRead ? (
                  <Button variant="outline" size="sm" onClick={() => onRead(item.id)}>
                    <Check className="mr-2 h-4 w-4" />
                    {t("notifications.read")}
                  </Button>
                ) : null}
                {item.actionUrl ? (
                  <Button variant="outline" size="sm" onClick={() => onAction(item)}>
                    {t(item.actionLabelKey || "notifications.open")}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("notifications.delete")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function NotificationCenter({ variant = "dashboard" }: { variant?: "dashboard" | "header" }) {
  const [open, setOpen] = useState(false);
  const [isTicketLoading, setIsTicketLoading] = useState(false);
  const [staffTicketUnreadCount, setStaffTicketUnreadCount] = useState(0);
  const [staffTickets, setStaffTickets] = useState<StaffTicketPreview[]>([]);
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isStaff } = useAuth();
  const { t, language } = useLanguage();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const canViewStaffNotifications = isAuthenticated && (isAdmin || isStaff);
  const totalUnreadCount = unreadCount + staffTicketUnreadCount;

  useEffect(() => {
    if (!canViewStaffNotifications) {
      setIsTicketLoading(false);
      setStaffTicketUnreadCount(0);
      setStaffTickets([]);
      return;
    }

    let active = true;
    const loadTickets = async () => {
      setIsTicketLoading(true);
      try {
        const response = await fetch("/api/tickets", { credentials: "include" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!active) {
          return;
        }

        const nextTickets = Array.isArray(payload?.tickets) ? payload.tickets : [];
        setStaffTicketUnreadCount(Number(payload?.unreadCount || 0) || 0);
        setStaffTickets(nextTickets.slice(0, 6));
      } finally {
        if (active) {
          setIsTicketLoading(false);
        }
      }
    };

    void loadTickets();
    const timer = window.setInterval(() => {
      void loadTickets();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [canViewStaffNotifications]);

  const groupedNotifications = useMemo(() => {
    const groups = new Map<NotificationCategory, NotificationItem[]>();
    notifications.forEach((item) => {
      const current = groups.get(item.category) || [];
      current.push(item);
      groups.set(item.category, current);
    });

    return Array.from(groups.entries());
  }, [notifications]);

  const handleAction = (item: NotificationItem) => {
    if (!item.actionUrl) {
      return;
    }

    markAsRead(item.id);
    setOpen(false);
    navigate(item.actionUrl);
  };

  const handleOpenStaffTickets = () => {
    setOpen(false);
    navigate("/admin/tickets");
  };

  const hasAnyNotifications = notifications.length > 0 || staffTickets.length > 0;
  const showStaffSection = canViewStaffNotifications && (isTicketLoading || staffTickets.length > 0);
  const buttonClass = variant === "header"
    ? "relative h-10 w-10 rounded-full border border-white/10 bg-transparent text-[#E31E24] hover:bg-white/10 hover:text-white"
    : "relative h-11 w-11 rounded-xl border-red-100 bg-white text-[#E31E24] hover:bg-red-50 hover:text-[#c21920]";
  const staffTitle = language === "ru" ? "Уведомления staff" : "Staff notifications";
  const staffEmptyText = language === "ru" ? "Новых staff-уведомлений нет." : "No new staff notifications.";
  const staffOpenText = language === "ru" ? "Открыть staff-центр" : "Open staff center";
  const staffStatusLabel = language === "ru" ? "Статус" : "Status";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={buttonClass}
        >
          <Bell className="h-5 w-5" />
          {totalUnreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#E31E24] px-1 text-[11px] font-bold text-white shadow-sm">
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1d1d1f]">
            <Bell className="h-5 w-5 text-[#E31E24]" />
            {t("notifications.title")}
          </DialogTitle>
          <DialogDescription>
            {t("notifications.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-gray-100 py-3">
          <div className="text-sm text-gray-500">
            {totalUnreadCount > 0 ? `${totalUnreadCount} ${t("notifications.unreadSuffix")}` : t("notifications.allRead")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={!notifications.length || unreadCount === 0}>
              <CheckCheck className="mr-2 h-4 w-4" />
              {t("notifications.readAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={deleteAllNotifications}
              disabled={!notifications.length}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("notifications.deleteAll")}
            </Button>
          </div>
        </div>

        {!hasAnyNotifications && !showStaffSection ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-[#E31E24]">
              <Bell className="h-7 w-7" />
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f]">{t("notifications.emptyTitle")}</div>
              <div className="text-sm text-gray-500">{t("notifications.emptyDescription")}</div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[56vh] pr-4">
            <div className="space-y-6">
              {showStaffSection ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-sky-600">{staffTitle}</div>
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                      {staffTicketUnreadCount > 0 ? staffTicketUnreadCount : staffTickets.length}
                    </Badge>
                  </div>
                  {isTicketLoading && staffTickets.length === 0 ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : staffTickets.length === 0 ? (
                    <div className="text-sm text-gray-500">{staffEmptyText}</div>
                  ) : (
                    <div className="space-y-3">
                      {staffTickets.map((item) => (
                        <Card key={item.id} className={`border shadow-none ${item.unreadCount > 0 ? "border-sky-100 bg-sky-50/60" : "bg-white"}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600">
                                <MessageSquareWarning className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <div className="font-semibold text-[#1d1d1f]">#{item.number} {item.subject}</div>
                                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                                    {staffTitle}
                                  </Badge>
                                  {item.unreadCount > 0 ? <Badge className="bg-[#E31E24] text-white">{item.unreadCount}</Badge> : null}
                                </div>
                                <div className="text-sm text-gray-600">{staffStatusLabel}: {item.status}</div>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                  <div className="text-xs text-gray-400">{formatNotificationTime(item.updatedAt || "", locale)}</div>
                                  <Button variant="outline" size="sm" onClick={handleOpenStaffTickets}>
                                    {staffOpenText}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
              {groupedNotifications.map(([category, items]) => {
                const meta = CATEGORY_META[category] || CATEGORY_META.system;

                return (
                  <section key={category} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-semibold ${meta.accentClass}`}>{t(meta.labelKey)}</div>
                      <Badge variant="outline" className={meta.badgeClass}>
                        {items.length}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <NotificationCard
                          key={item.id}
                          item={item}
                          onRead={markAsRead}
                          onDelete={deleteNotification}
                          onAction={handleAction}
                          t={t}
                          locale={locale}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}