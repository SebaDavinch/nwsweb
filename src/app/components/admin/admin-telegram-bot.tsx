import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, MessageCircle, Save, Send, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface TelegramBotSettings {
  enabled: boolean;
  pollingEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  adminChatIds: string[];
  sync: {
    tickets: boolean;
    news: boolean;
    notams: boolean;
    alerts: boolean;
  };
  commands: {
    start: boolean;
    menu: boolean;
    link: boolean;
    help: boolean;
    ping: boolean;
    profile: boolean;
    booking: boolean;
    news: boolean;
    notams: boolean;
    events: boolean;
    roster: boolean;
    metar: boolean;
    taf: boolean;
    settings: boolean;
    ticket: boolean;
  };
  updatedAt?: string | null;
}

interface TicketCategory {
  id: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
}

interface TelegramBotConfigResponse {
  botSettings?: TelegramBotSettings | null;
  ticketConfig?: {
    enabled?: boolean;
    categories?: TicketCategory[];
  } | null;
}

const SYNC_FIELDS: Array<{ key: keyof TelegramBotSettings["sync"]; label: string; description: string }> = [
  { key: "tickets", label: "Тикеты", description: "Разрешить Telegram-боту создавать тикеты и отвечать в них." },
  { key: "news", label: "Новости", description: "Разрешить Telegram-боту публиковать новости и события через сайт." },
  { key: "notams", label: "NOTAM", description: "Разрешить Telegram-боту создавать NOTAM через backend сайта." },
  { key: "alerts", label: "Оповещения", description: "Отправка staff-alert и тестовых уведомлений в admin chats." },
];

const COMMAND_FIELDS: Array<{ key: keyof TelegramBotSettings["commands"]; label: string; description: string }> = [
  { key: "start", label: "/start", description: "Открыть стартовое сообщение и главное меню." },
  { key: "menu", label: "/menu", description: "Показать инлайн-меню бота." },
  { key: "link", label: "/link", description: "Привязать Telegram к профилю пилота по коду." },
  { key: "help", label: "/help", description: "Список доступных команд." },
  { key: "ping", label: "/ping", description: "Быстрая проверка, что бот онлайн." },
  { key: "profile", label: "/profile", description: "Профиль пилота." },
  { key: "booking", label: "/booking", description: "Текущий букинг пилота." },
  { key: "ticket", label: "/ticket", description: "Список тикетов, создание и ответы через Telegram." },
  { key: "news", label: "/news", description: "Последние новости сайта." },
  { key: "notams", label: "/notams", description: "Оперативные NOTAM." },
  { key: "events", label: "/events", description: "Ближайшие события." },
  { key: "roster", label: "/roster", description: "Ростер пилотов." },
  { key: "metar", label: "/metar", description: "Погода METAR по ICAO." },
  { key: "taf", label: "/taf", description: "Прогноз TAF по ICAO." },
  { key: "settings", label: "/settings", description: "Настройки Telegram-уведомлений пилота." },
];

const parseAdminChatIds = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export function AdminTelegramBot() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [settings, setSettings] = useState<TelegramBotSettings | null>(null);
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [adminChatInput, setAdminChatInput] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/telegram-bot/config", {
        credentials: "include",
      });
      const payload = (response.ok ? await response.json() : null) as TelegramBotConfigResponse | null;
      const nextSettings = payload?.botSettings || null;
      setSettings(nextSettings);
      setTicketCategories(Array.isArray(payload?.ticketConfig?.categories) ? payload!.ticketConfig!.categories! : []);
      setAdminChatInput(Array.isArray(nextSettings?.adminChatIds) ? nextSettings!.adminChatIds!.join("\n") : "");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const enabledCategories = useMemo(
    () => ticketCategories.filter((item) => item?.enabled !== false),
    [ticketCategories]
  );

  const updateSync = (key: keyof TelegramBotSettings["sync"], value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, sync: { ...prev.sync, [key]: value } } : prev));
  };

  const updateCommand = (key: keyof TelegramBotSettings["commands"], value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, commands: { ...prev.commands, [key]: value } } : prev));
  };

  const save = async () => {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    try {
      await fetch("/api/admin/telegram-bot/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          adminChatIds: parseAdminChatIds(adminChatInput),
        }),
      });
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const sendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const response = await fetch("/api/admin/telegram-bot/test-notification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || "Не удалось отправить тестовое уведомление Telegram"));
      }
      toast.success("Тестовое уведомление Telegram отправлено");
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : "Не удалось отправить тестовое уведомление Telegram"));
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Telegram bot settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Telegram Bot</h2>
          <p className="text-sm text-gray-500">
            Управление Telegram-ботом: меню, тикеты, pilot-уведомления и staff admin chats.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendTestNotification} disabled={isSendingTest}>
            {isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            Отправить тест
          </Button>
          <Button onClick={save} disabled={isSaving} className="bg-[#E31E24] hover:bg-[#c91a1f]">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Сохранить настройки
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Runtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <div className="font-medium text-gray-900">Интеграция с ботом включена</div>
                  <div className="text-xs text-gray-500">Главный переключатель Telegram-интеграции сайта.</div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => (prev ? { ...prev, enabled: Boolean(checked) } : prev))
                  }
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Текущий Telegram runtime работает через long polling. Webhook в активный сценарий не входит и в админке больше не является рабочей настройкой.
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <MessageCircle className="h-4 w-4 text-gray-500" />
                    Режим бота
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {settings.pollingEnabled ? "Long polling включён." : "Long polling отключён в конфиге."}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Shield className="h-4 w-4 text-gray-500" />
                    Admin chats
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {parseAdminChatIds(adminChatInput).length} chat{parseAdminChatIds(adminChatInput).length === 1 ? "" : "s"} для staff-уведомлений.
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Send className="h-4 w-4 text-gray-500" />
                    Ticket flow
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Создание, список, ответы и закрытие тикетов через Telegram-меню.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Синхронизация</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SYNC_FIELDS.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                  <Switch checked={Boolean(settings.sync[item.key])} onCheckedChange={(checked) => updateSync(item.key, Boolean(checked))} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Категории тикетов для Telegram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {enabledCategories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  Категории ещё не настроены. Пока список пуст, Telegram-бот не сможет создавать тикеты.
                </div>
              ) : (
                enabledCategories.map((category) => (
                  <div key={category.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="font-medium text-gray-900">{category.name}</div>
                    <div className="text-xs text-gray-500">{category.description || category.id}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Доступные команды</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {COMMAND_FIELDS.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                  <Switch checked={Boolean(settings.commands[item.key])} onCheckedChange={(checked) => updateCommand(item.key, Boolean(checked))} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Что сейчас реально работает</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                Инлайн-меню, профиль, букинг, новости, NOTAM, события, ростер, METAR, TAF, тикеты и пользовательские настройки уведомлений.
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                PIREP-уведомления идут по статусам review/accepted/rejected/invalidated и по сценариям, где пилоту нужен ответ.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Admin chats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Admin chat IDs</label>
                <Textarea
                  value={adminChatInput}
                  onChange={(event) => setAdminChatInput(event.target.value)}
                  placeholder={"One chat ID per line\n123456789\n-1009876543210"}
                  className="min-h-40"
                />
                <div className="text-xs text-gray-500">
                  Эти чаты получают test/staff уведомления и используются как staff endpoint для Telegram.
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                В Telegram нет ролей как в Discord, поэтому доступ staff задаётся явным списком chat ID.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {parseAdminChatIds(adminChatInput).map((chatId) => (
                  <div key={chatId} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <div className="font-medium text-gray-900">{chatId}</div>
                      <div className="text-xs text-gray-500">Authorized admin chat</div>
                    </div>
                    <Send className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
