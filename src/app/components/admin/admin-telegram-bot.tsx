import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Save, Send, Shield, Webhook } from "lucide-react";
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
    help: boolean;
    ping: boolean;
    news: boolean;
    notams: boolean;
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
  { key: "tickets", label: "Tickets", description: "Allow Telegram bot to create and update tickets." },
  { key: "news", label: "News", description: "Allow Telegram bot to publish website news." },
  { key: "notams", label: "NOTAMs", description: "Allow Telegram bot to create NOTAM entries." },
  { key: "alerts", label: "Alerts", description: "Allow Telegram bot to create dashboard alerts." },
];

const COMMAND_FIELDS: Array<{ key: keyof TelegramBotSettings["commands"]; label: string; description: string }> = [
  { key: "start", label: "/start", description: "Greeting and onboarding command." },
  { key: "help", label: "/help", description: "Command list and usage help." },
  { key: "ping", label: "/ping", description: "Simple health check." },
  { key: "news", label: "/news", description: "Latest website news feed." },
  { key: "notams", label: "/notams", description: "Operational NOTAM feed." },
  { key: "ticket", label: "/ticket", description: "Create website support tickets from Telegram." },
];

const parseAdminChatIds = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export function AdminTelegramBot() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
            Manage Telegram bot runtime, allowed commands, content sync and admin chats.
          </p>
        </div>
        <Button onClick={save} disabled={isSaving} className="bg-[#E31E24] hover:bg-[#c91a1f]">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
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
                  <div className="font-medium text-gray-900">Bot integration enabled</div>
                  <div className="text-xs text-gray-500">Master switch for website to Telegram integration.</div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => (prev ? { ...prev, enabled: Boolean(checked) } : prev))
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <div className="font-medium text-gray-900">Long polling</div>
                    <div className="text-xs text-gray-500">Default runtime mode for the current bot service.</div>
                  </div>
                  <Switch
                    checked={settings.pollingEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => (prev ? { ...prev, pollingEnabled: Boolean(checked) } : prev))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <div className="font-medium text-gray-900">Webhook mode</div>
                    <div className="text-xs text-gray-500">Prepared for the next stage when webhook delivery is added.</div>
                  </div>
                  <Switch
                    checked={settings.webhookEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => (prev ? { ...prev, webhookEnabled: Boolean(checked) } : prev))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Webhook URL</label>
                <Input
                  value={settings.webhookUrl || ""}
                  onChange={(event) =>
                    setSettings((prev) => (prev ? { ...prev, webhookUrl: event.target.value } : prev))
                  }
                  placeholder="https://your-domain.example/api/telegram/webhook"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <MessageCircle className="h-4 w-4 text-gray-500" />
                    Bot mode
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {settings.pollingEnabled ? "Long polling is enabled." : "Long polling is disabled."}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Webhook className="h-4 w-4 text-gray-500" />
                    Webhook
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {settings.webhookEnabled ? "Webhook mode is enabled in config." : "Webhook mode is currently off."}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Shield className="h-4 w-4 text-gray-500" />
                    Admin chats
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {parseAdminChatIds(adminChatInput).length} configured admin chat{parseAdminChatIds(adminChatInput).length === 1 ? "" : "s"}.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Content sync</CardTitle>
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
              <CardTitle className="text-base">Ticket categories available to the bot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {enabledCategories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  No ticket categories configured yet. The Telegram bot will not be able to create tickets until categories are added.
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
              <CardTitle className="text-base">Enabled commands</CardTitle>
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
              <CardTitle className="text-base">Current stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                The current Telegram bot already supports content reading and ticket/content creation through the website backend.
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                Next stage: inline buttons, ticket thread sync, notifications to admin chats, and optional webhook delivery.
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
                  These chats are allowed to use admin-only Telegram commands like content publishing.
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Telegram does not have guild roles like Discord, so access is currently managed by explicit chat IDs.
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
