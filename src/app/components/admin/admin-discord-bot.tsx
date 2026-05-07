import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Bot, Loader2, Save, Search, Shield, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useLanguage } from "../../context/language-context";

interface NotificationTemplate {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

interface DiscordAdminUser {
  id: string;
  discordId: string;
  username?: string;
  email?: string;
  role?: "admin" | "staff";
  linkedBy?: string;
}

interface DiscordGuildRole {
  id: string;
  name: string;
  color: string;
  position: number;
  managed: boolean;
  mentionable: boolean;
  selected: boolean;
}

interface DiscordGuildChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
}

interface DiscordGuildInfo {
  id: string;
  name: string;
  iconUrl: string | null;
  approximateMemberCount: number | null;
}

interface DiscordGuildMemberRole {
  id: string;
  name: string;
  color: string;
}

interface DiscordGuildMember {
  discordId: string;
  username: string;
  discriminator: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  nick: string | null;
  roleIds: string[];
  roles: DiscordGuildMemberRole[];
}

interface DiscordGuildSnapshot {
  configured: boolean;
  guild: DiscordGuildInfo | null;
  roles: DiscordGuildRole[];
  channels: DiscordGuildChannel[];
  adminRoleIds: string[];
  adminUsers: DiscordAdminUser[];
}

interface DiscordBotSettings {
  enabled: boolean;
  webhookUrl: string;
  monitoredGuildId: string;
  adminRoleIds: string[];
  sync: {
    tickets: boolean;
    news: boolean;
    notams: boolean;
    alerts: boolean;
  };
  notifications: {
    bookingCreated: boolean;
    flightTakeoff: boolean;
    flightLanding: boolean;
    pirepReview: boolean;
    ticketCreated: boolean;
    ticketReply: boolean;
    ticketUpdated: boolean;
    ticketClosed: boolean;
    newsCreated: boolean;
    notamCreated: boolean;
    alertCreated: boolean;
  };
  channels: {
    bookings: string;
    flights: string;
    pirepReview: string;
    tickets: string;
    news: string;
    notams: string;
    alerts: string;
  };
  pirepAlerts: {
    awaitingReview: boolean;
    reviewStarted: boolean;
    staffComment: boolean;
    pilotDmOnReviewStarted: boolean;
    pilotDmOnStaffComment: boolean;
  };
  templates?: Record<string, NotificationTemplate>;
}

const SYNC_KEYS: Array<keyof DiscordBotSettings["sync"]> = ["tickets", "news", "notams", "alerts"];

export function AdminDiscordBot() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const CHANNEL_FIELDS: Array<{ key: keyof DiscordBotSettings["channels"]; label: string; description: string }> = [
    { key: "bookings", label: tr("Бронирования", "Bookings"), description: tr("Уведомления о создании и обновлении броней.", "Notifications for booking creation and updates.") },
    { key: "flights", label: tr("Рейсы", "Flights"), description: tr("Обновления по взлётам и посадкам.", "Takeoff and landing updates.") },
    { key: "pirepReview", label: tr("Проверка PIREP", "PIREP Review"), description: tr("Напоминания по очереди проверки.", "Review queue reminders.") },
    { key: "tickets", label: tr("Тикеты", "Tickets"), description: tr("Создание, обновление, ответы и закрытие.", "Creation, updates, replies, and closure.") },
    { key: "news", label: tr("Новости", "News"), description: tr("Публикации новостей сайта.", "Site news publications.") },
    { key: "notams", label: "NOTAM", description: tr("Операционные бюллетени.", "Operational bulletins.") },
    { key: "alerts", label: tr("Оповещения", "Alerts"), description: tr("Оповещения панели и операций.", "Dashboard and operations alerts.") },
  ];

  const NOTIFICATION_FIELDS: Array<{ key: keyof DiscordBotSettings["notifications"]; label: string; description: string }> = [
    { key: "bookingCreated", label: tr("Бронь создана", "Booking created"), description: tr("Пилот создал бронирование.", "A pilot created a booking.") },
    { key: "flightTakeoff", label: tr("Рейс взлетел", "Flight departed"), description: tr("Уведомление о вылете.", "Departure notification.") },
    { key: "flightLanding", label: tr("Рейс приземлился", "Flight landed"), description: tr("Уведомление о прибытии.", "Arrival notification.") },
    { key: "pirepReview", label: tr("Проверка PIREP", "PIREP review"), description: tr("Новый элемент в очереди проверки.", "New item in the review queue.") },
    { key: "ticketCreated", label: tr("Тикет создан", "Ticket created"), description: tr("Отправлен новый тикет поддержки.", "A new support ticket was submitted.") },
    { key: "ticketReply", label: tr("Ответ в тикете", "Ticket reply"), description: tr("Новое сообщение в существующем тикете.", "A new message in an existing ticket.") },
    { key: "ticketUpdated", label: tr("Тикет обновлён", "Ticket updated"), description: tr("Изменились приоритет, исполнитель или статус.", "Priority, assignee, or status changed.") },
    { key: "ticketClosed", label: tr("Тикет закрыт", "Ticket closed"), description: tr("Тикет переведён в закрытое состояние.", "Ticket moved to closed state.") },
    { key: "newsCreated", label: tr("Новость опубликована", "News published"), description: tr("На сайте опубликована новость.", "A news item was published on the site.") },
    { key: "notamCreated", label: tr("NOTAM создан", "NOTAM created"), description: tr("NOTAM создан или обновлён.", "A NOTAM was created or updated.") },
    { key: "alertCreated", label: tr("Оповещение создано", "Alert created"), description: tr("Оповещение создано или обновлено.", "An alert was created or updated.") },
  ];

  const PIREP_ALERT_FIELDS: Array<{ key: keyof DiscordBotSettings["pirepAlerts"]; label: string; description: string }> = [
    { key: "awaitingReview", label: tr("Ожидает проверки", "Awaiting review"), description: tr("Отправлять персоналу оповещение, когда новый PIREP попадает в очередь проверки.", "Send staff an alert when a new PIREP enters the review queue.") },
    { key: "reviewStarted", label: tr("Проверка начата", "Review started"), description: tr("Отправлять персоналу оповещение, когда PIREP переводится в статус проверки.", "Send staff an alert when a PIREP is moved to review status.") },
    { key: "staffComment", label: tr("Комментарий персонала", "Staff comment"), description: tr("Отправлять персоналу оповещение, когда к PIREP добавлен комментарий сотрудника.", "Send staff an alert when a staff comment is added to a PIREP.") },
    { key: "pilotDmOnReviewStarted", label: tr("ЛС пилоту: проверка начата", "DM pilot: review started"), description: tr("Отправлять пилоту личное сообщение, когда персонал берёт PIREP в проверку.", "Send the pilot a DM when staff begins reviewing their PIREP.") },
    { key: "pilotDmOnStaffComment", label: tr("ЛС пилоту: комментарий персонала", "DM pilot: staff comment"), description: tr("Отправлять пилоту личное сообщение, когда персонал оставляет комментарий к PIREP.", "Send the pilot a DM when staff leaves a comment on their PIREP.") },
  ];
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [isMutatingAccess, setIsMutatingAccess] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [settings, setSettings] = useState<DiscordBotSettings | null>(null);
  const [guildSnapshot, setGuildSnapshot] = useState<DiscordGuildSnapshot | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<DiscordGuildMember[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [configResponse, guildResponse] = await Promise.all([
        fetch("/api/admin/discord-bot/config", { credentials: "include" }),
        fetch("/api/admin/discord-bot/guild", { credentials: "include" }),
      ]);

      const configPayload = configResponse.ok ? await configResponse.json() : null;
      const guildPayload = guildResponse.ok ? await guildResponse.json() : null;

      setSettings(configPayload?.botSettings || null);
      setGuildSnapshot(guildPayload || null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const templateKeys = useMemo(() => {
    const keys = new Set<string>(NOTIFICATION_FIELDS.map((item) => item.key));
    Object.keys(settings?.templates || {}).forEach((key) => keys.add(key));
    return Array.from(keys.values());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.templates, language]);

  const availableTextChannels = useMemo(
    () => (guildSnapshot?.channels || []).filter((channel) => [0, 5, 10, 11, 12, 15].includes(channel.type)),
    [guildSnapshot?.channels]
  );

  const currentAdminUsers = guildSnapshot?.adminUsers || [];

  const updateSync = (key: keyof DiscordBotSettings["sync"], value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, sync: { ...prev.sync, [key]: value } } : prev));
  };

  const updateNotification = (key: keyof DiscordBotSettings["notifications"], value: boolean) => {
    setSettings((prev) =>
      prev ? { ...prev, notifications: { ...prev.notifications, [key]: value } } : prev
    );
  };

  const updateChannel = (key: keyof DiscordBotSettings["channels"], value: string) => {
    setSettings((prev) => (prev ? { ...prev, channels: { ...prev.channels, [key]: value } } : prev));
  };

  const updatePirepAlert = (key: keyof DiscordBotSettings["pirepAlerts"], value: boolean) => {
    setSettings((prev) =>
      prev ? { ...prev, pirepAlerts: { ...prev.pirepAlerts, [key]: value } } : prev
    );
  };

  const updateTemplate = (templateId: string, patch: Partial<NotificationTemplate>) => {
    setSettings((prev) => {
      if (!prev) {
        return prev;
      }

      const currentTemplate = prev.templates?.[templateId] || {
        id: templateId,
        title: "",
        description: "",
        enabled: true,
      };

      return {
        ...prev,
        templates: {
          ...(prev.templates || {}),
          [templateId]: {
            ...currentTemplate,
            ...patch,
          },
        },
      };
    });
  };

  const toggleAdminRole = (roleId: string) => {
    setSettings((prev) => {
      if (!prev) {
        return prev;
      }

      const current = new Set(prev.adminRoleIds || []);
      if (current.has(roleId)) {
        current.delete(roleId);
      } else {
        current.add(roleId);
      }

      return {
        ...prev,
        adminRoleIds: Array.from(current),
      };
    });
  };

  const save = async () => {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    try {
      await fetch("/api/admin/discord-bot/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const searchMembers = useCallback(async () => {
    if (memberQuery.trim().length < 2) {
      setMemberResults([]);
      return;
    }

    setIsSearchingMembers(true);
    try {
      const response = await fetch(`/api/admin/discord-bot/members?query=${encodeURIComponent(memberQuery.trim())}`, {
        credentials: "include",
      });
      const payload = response.ok ? await response.json() : null;
      setMemberResults(Array.isArray(payload?.members) ? payload.members : []);
    } finally {
      setIsSearchingMembers(false);
    }
  }, [memberQuery]);

  const grantAccess = async (member: DiscordGuildMember, role: "admin" | "staff") => {
    setIsMutatingAccess(true);
    try {
      await fetch("/api/admin/access/grant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: member.discordId,
          username: member.username,
          role,
        }),
      });
      await loadData();
    } finally {
      setIsMutatingAccess(false);
    }
  };

  const revokeAccess = async (discordId: string) => {
    setIsMutatingAccess(true);
    try {
      await fetch("/api/admin/access/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId }),
      });
      await loadData();
    } finally {
      setIsMutatingAccess(false);
    }
  };

  const sendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const response = await fetch("/api/admin/discord-bot/test-notification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || tr("Не удалось отправить тестовое уведомление Discord", "Failed to send Discord test notification")));
      }
      toast.success(tr("Тестовое уведомление Discord отправлено", "Discord test notification sent"));
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Не удалось отправить тестовое уведомление Discord", "Failed to send Discord test notification")));
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr("Загрузка настроек бота...", "Loading bot settings...")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Discord-{tr("бот", "Bot")}</h2>
          <p className="text-sm text-gray-500">
            {tr("Управление синхронизацией, маршрутизацией, ролями сервера и админ-доступом для Discord-бота.", "Manage sync, routing, server roles, and admin access for the Discord bot.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendTestNotification} disabled={isSendingTest}>
            {isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            {tr("Отправить тестовое уведомление", "Send test notification")}
          </Button>
          <Button onClick={save} disabled={isSaving} className="bg-[#E31E24] hover:bg-[#c91a1f]">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {tr("Сохранить настройки", "Save settings")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">{tr("Настройки", "Settings")}</TabsTrigger>
          <TabsTrigger value="channels">{tr("Каналы", "Channels")}</TabsTrigger>
          <TabsTrigger value="access">{tr("Доступ", "Access")}</TabsTrigger>
          <TabsTrigger value="templates">{tr("Шаблоны", "Templates")}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Общие настройки", "General Settings")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <div className="font-medium text-gray-900">{tr("Интеграция с ботом включена", "Bot integration enabled")}</div>
                  <div className="text-xs text-gray-500">{tr("Главный переключатель для всех действий сайта через Discord-бота.", "Master switch for all site actions via the Discord bot.")}</div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => (prev ? { ...prev, enabled: Boolean(checked) } : prev))
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{tr("ID отслеживаемого сервера", "Monitored server ID")}</label>
                  <Input
                    value={settings.monitoredGuildId || ""}
                    onChange={(event) =>
                      setSettings((prev) => (prev ? { ...prev, monitoredGuildId: event.target.value } : prev))
                    }
                    placeholder={tr("ID Discord-сервера", "Discord server ID")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{tr("Резервный URL вебхука", "Fallback webhook URL")}</label>
                  <Input
                    value={settings.webhookUrl || ""}
                    onChange={(event) =>
                      setSettings((prev) => (prev ? { ...prev, webhookUrl: event.target.value } : prev))
                    }
                    placeholder={tr("Резервный вариант, если отправка через токен бота в канал недоступна", "Fallback if bot token channel delivery is unavailable")}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {guildSnapshot?.guild?.name || tr("Discord-сервер ещё не привязан", "Discord server not yet linked")}
                    </div>
                    <div className="text-xs text-gray-500">
                      {guildSnapshot?.configured
                        ? `${tr("ID сервера", "Server ID")} ${guildSnapshot.guild?.id} • ${tr("Ролей", "Roles")} ${guildSnapshot.roles.length} • ${tr("Каналов", "Channels")} ${guildSnapshot.channels.length}`
                        : tr("Укажите ID отслеживаемого сервера и убедитесь, что бот имеет к нему доступ.", "Enter the monitored server ID and make sure the bot has access to it.")}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Синхронизация контента", "Content Sync")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SYNC_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <div className="font-medium capitalize text-gray-900">{key === "tickets" ? tr("Тикеты", "Tickets") : key === "news" ? tr("Новости", "News") : key === "notams" ? "NOTAM" : tr("Оповещения", "Alerts")}</div>
                    <div className="text-xs text-gray-500">{tr("Разрешить Discord синхронизировать этот контент на сайт.", "Allow Discord to sync this content to the site.")}</div>
                  </div>
                  <Switch checked={Boolean(settings.sync[key])} onCheckedChange={(checked) => updateSync(key, Boolean(checked))} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Переключатели уведомлений", "Notification Toggles")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {NOTIFICATION_FIELDS.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div className="pr-4">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                  <Switch
                    checked={Boolean(settings.notifications[item.key])}
                    onCheckedChange={(checked) => updateNotification(item.key, Boolean(checked))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Сценарий проверки PIREP", "PIREP Review Scenario")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {tr("Использует настроенный канал проверки PIREP для уведомлений персоналу и личных сообщений пилотам о смене статуса проверки.", "Uses the configured PIREP review channel for staff notifications and pilot DMs about review status changes.")}
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {PIREP_ALERT_FIELDS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div className="pr-4">
                      <div className="font-medium text-gray-900">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                    <Switch
                      checked={Boolean(settings.pirepAlerts?.[item.key])}
                      onCheckedChange={(checked) => updatePirepAlert(item.key, Boolean(checked))}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Маршрутизация каналов", "Channel Routing")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHANNEL_FIELDS.map((field) => {
                const currentValue = settings.channels[field.key] || "";
                const selectedChannel = availableTextChannels.find((c) => c.id === currentValue);
                return (
                  <div key={field.key} className="space-y-2 rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <Bell className="h-4 w-4 text-gray-500" />
                      {field.label}
                    </div>
                    <div className="text-xs text-gray-500">{field.description}</div>
                    {availableTextChannels.length > 0 ? (
                      <select
                        value={currentValue}
                        onChange={(e) => updateChannel(field.key, e.target.value)}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                      >
                        <option value="">{tr("— Не выбран —", "— Not selected —")}</option>
                        {availableTextChannels.map((ch) => (
                          <option key={ch.id} value={ch.id}>#{ch.name}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={currentValue}
                        onChange={(event) => updateChannel(field.key, event.target.value)}
                        placeholder={tr("ID Discord-канала", "Discord channel ID")}
                      />
                    )}
                    {currentValue && selectedChannel && (
                      <div className="text-xs text-gray-400">ID: {currentValue}</div>
                    )}
                    {currentValue && !selectedChannel && availableTextChannels.length > 0 && (
                      <div className="text-xs text-amber-600">{tr("Канал не найден в списке сервера", "Channel not found in server list")}</div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Доступные текстовые каналы", "Available Text Channels")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableTextChannels.length > 0 ? (
                availableTextChannels.map((channel) => (
                  <div key={channel.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="font-medium text-gray-900">#{channel.name}</div>
                    <div className="text-xs text-gray-500">{channel.id}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">{tr("Данные по каналам сервера пока недоступны.", "Server channel data is not yet available.")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Роли администраторов", "Admin Roles")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                {tr("Выбранные роли получают расширенный доступ к боту и используются для упоминаний в тикетах.", "Selected roles receive elevated bot access and are used for ticket mentions.")}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(guildSnapshot?.roles || []).map((role) => {
                  const checked = (settings.adminRoleIds || []).includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleAdminRole(role.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        checked ? "border-[#E31E24] bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-gray-900">{role.name}</div>
                        <div className={`h-3 w-3 rounded-full ${checked ? "bg-[#E31E24]" : "bg-gray-300"}`} />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {role.id} • {tr("Позиция", "Position")} {role.position}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Индивидуальный доступ", "Individual Access")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder={tr("Поиск участников сервера по имени пользователя или отображаемому имени", "Search server members by username or display name")}
                />
                <Button onClick={() => searchMembers()} disabled={isSearchingMembers}>
                  {isSearchingMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  {tr("Найти", "Search")}
                </Button>
              </div>

              <div className="space-y-3">
                {memberResults.map((member) => (
                  <div key={member.discordId} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {member.nick || member.globalName || member.username}
                        </div>
                        <div className="text-xs text-gray-500">
                          @{member.username} • {member.discordId}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {member.roles.slice(0, 6).map((role) => (
                            <span key={role.id} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={isMutatingAccess} onClick={() => grantAccess(member, "staff")}>
                          <Shield className="mr-2 h-4 w-4" />
                          {tr("Выдать staff", "Grant staff")}
                        </Button>
                        <Button size="sm" disabled={isMutatingAccess} onClick={() => grantAccess(member, "admin")}>
                          <UserCog className="mr-2 h-4 w-4" />
                          {tr("Выдать admin", "Grant admin")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {!isSearchingMembers && memberQuery.trim().length >= 2 && memberResults.length === 0 ? (
                  <div className="text-sm text-gray-500">{tr("Подходящие участники сервера не найдены.", "No matching server members found.")}</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Текущие привилегированные пользователи", "Current Privileged Users")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentAdminUsers.length > 0 ? (
                currentAdminUsers.map((user) => (
                  <div key={user.discordId || user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                    <div>
                      <div className="font-medium text-gray-900">{user.username || user.discordId}</div>
                      <div className="text-xs text-gray-500">
                        {user.discordId} • {(user.role || "admin").toUpperCase()}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled={isMutatingAccess} onClick={() => revokeAccess(user.discordId)}>
                      {tr("Отозвать", "Revoke")}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">{tr("Индивидуальные доступы пока не выданы.", "No individual access grants yet.")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{tr("Шаблоны уведомлений", "Notification Templates")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                {tr("Настраивайте заголовок и текст embed через переменные вроде", "Customize the embed title and body using variables like")} <code>{"{{ticketNumber}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{content}}"}</code>, <code>{"{{status}}"}</code>.
              </p>

              {templateKeys.map((templateId) => {
                const template = settings.templates?.[templateId] || {
                  id: templateId,
                  title: "",
                  description: "",
                  enabled: true,
                };

                return (
                  <div key={templateId} className="space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">{templateId}</div>
                      <Switch
                        checked={Boolean(template.enabled)}
                        onCheckedChange={(checked) => updateTemplate(templateId, { enabled: Boolean(checked) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">{tr("Заголовок embed", "Embed title")}</label>
                      <Input
                        value={template.title || ""}
                        onChange={(event) => updateTemplate(templateId, { title: event.target.value })}
                        placeholder={tr("Шаблон заголовка embed", "Embed title template")}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">{tr("Описание embed", "Embed description")}</label>
                      <Textarea
                        value={template.description || ""}
                        onChange={(event) => updateTemplate(templateId, { description: event.target.value })}
                        placeholder={tr("Шаблон описания embed", "Embed description template")}
                        rows={3}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
