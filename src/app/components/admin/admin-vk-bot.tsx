import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

interface VkBotFaqItem {
  id: string;
  question: string;
  answer: string;
  keywords?: string[];
  enabled?: boolean;
  order?: number;
}

interface VkBotMenuItem {
  id: string;
  label: string;
  action: "faq" | "url" | "text";
  value: string;
  enabled?: boolean;
  order?: number;
}

interface VkAnnouncementTemplate {
  id: string;
  title: string;
  enabled: boolean;
  text: string;
}

interface VkAutoMessages {
  start: string;
  menu: string;
  faqMiss: string;
}

interface VkReplyTemplate {
  id: string;
  title: string;
  matchMode: "contains" | "exact" | "regex";
  trigger: string;
  response: string;
  enabled?: boolean;
  order?: number;
}

interface VkDialogMenuButton {
  id: string;
  label: string;
  type: "text" | "url" | "faq" | "menu";
  value: string;
  enabled?: boolean;
  order?: number;
}

interface VkDialogMenu {
  enabled: boolean;
  oneTime: boolean;
  inline: boolean;
  buttons: VkDialogMenuButton[];
}

interface VkBotSettings {
  enabled: boolean;
  groupId: string;
  accessToken: string;
  sync: {
    news: boolean;
    events: boolean;
    notams: boolean;
    alerts: boolean;
    telegramMirror: boolean;
  };
  telegramMirrorChatId: string;
  faqEnabled: boolean;
  menuEnabled: boolean;
  longPollWaitSeconds: number;
  welcomeMessage: string;
  fallbackMessage: string;
  menuTitle: string;
  autoMessages: VkAutoMessages;
  faqItems: VkBotFaqItem[];
  menuItems: VkBotMenuItem[];
  replyTemplates: VkReplyTemplate[];
  dialogMenu: VkDialogMenu;
  announcementTemplates: Record<string, VkAnnouncementTemplate>;
  updatedAt?: string | null;
}

interface VkBotConfigResponse {
  botSettings?: VkBotSettings | null;
}

const VK_ANNOUNCEMENT_TEMPLATE_META: Array<{ id: string; label: string; description: string }> = [
  { id: "default", label: "Default", description: "Fallback for all categories when specific template is not configured." },
  { id: "news", label: "News", description: "Template for published news posts." },
  { id: "event", label: "Event", description: "Template for event announcements." },
  { id: "notam", label: "NOTAM", description: "Template for NOTAM messages." },
  { id: "alert", label: "Alert", description: "Template for alert posts." },
];

const parseJsonArray = <T,>(value: string, fallback: T[]): T[] => {
  if (!String(value || "").trim()) {
    return fallback;
  }

  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array");
  }

  return parsed as T[];
};

const parseJsonObject = <T,>(value: string, fallback: T): T => {
  if (!String(value || "").trim()) {
    return fallback;
  }
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as T;
};

export function AdminVkBot() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [settings, setSettings] = useState<VkBotSettings | null>(null);
  const [faqJson, setFaqJson] = useState("[]");
  const [menuJson, setMenuJson] = useState("[]");
  const [replyTemplatesJson, setReplyTemplatesJson] = useState("[]");
  const [dialogMenuJson, setDialogMenuJson] = useState("{}");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/vk-bot/config", { credentials: "include" });
      const payload = (response.ok ? await response.json() : null) as VkBotConfigResponse | null;
      const nextSettings = payload?.botSettings || null;
      setSettings(nextSettings);
      setFaqJson(JSON.stringify(nextSettings?.faqItems || [], null, 2));
      setMenuJson(JSON.stringify(nextSettings?.menuItems || [], null, 2));
      setReplyTemplatesJson(JSON.stringify(nextSettings?.replyTemplates || [], null, 2));
      setDialogMenuJson(JSON.stringify(nextSettings?.dialogMenu || {}, null, 2));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const templateKeys = useMemo(() => {
    const keys = new Set<string>(VK_ANNOUNCEMENT_TEMPLATE_META.map((item) => item.id));
    Object.keys(settings?.announcementTemplates || {}).forEach((key) => keys.add(key));
    return Array.from(keys.values());
  }, [settings?.announcementTemplates]);

  const save = async () => {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/vk-bot/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          faqItems: parseJsonArray<VkBotFaqItem>(faqJson, settings.faqItems || []),
          menuItems: parseJsonArray<VkBotMenuItem>(menuJson, settings.menuItems || []),
          replyTemplates: parseJsonArray<VkReplyTemplate>(replyTemplatesJson, settings.replyTemplates || []),
          dialogMenu: parseJsonObject<VkDialogMenu>(dialogMenuJson, settings.dialogMenu),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || "Не удалось сохранить VK bot settings"));
      }
      toast.success("VK bot settings saved");
      await loadData();
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : "Не удалось сохранить VK bot settings"));
    } finally {
      setIsSaving(false);
    }
  };

  const sendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const response = await fetch("/api/admin/vk-bot/test-notification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || "Не удалось отправить тестовое уведомление VK"));
      }
      toast.success("VK test notification sent");
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : "Не удалось отправить тестовое уведомление VK"));
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading VK bot settings...
      </div>
    );
  }

  const updateSync = (key: keyof VkBotSettings["sync"], value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, sync: { ...prev.sync, [key]: value } } : prev));
  };

  const updateAnnouncementTemplate = (templateId: string, patch: Partial<VkAnnouncementTemplate>) => {
    setSettings((prev) => {
      if (!prev) {
        return prev;
      }
      const currentTemplate = prev.announcementTemplates?.[templateId] || {
        id: templateId,
        title: templateId.toUpperCase(),
        enabled: true,
        text: "",
      };

      return {
        ...prev,
        announcementTemplates: {
          ...(prev.announcementTemplates || {}),
          [templateId]: {
            ...currentTemplate,
            ...patch,
            id: templateId,
          },
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">VK Bot</h2>
          <p className="text-sm text-gray-500">
            Separate VK community bot linked to backend config, FAQ, menu, and Telegram mirroring.
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

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Runtime</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <div className="font-medium text-gray-900">Интеграция с VK ботом включена</div>
              <div className="text-xs text-gray-500">Главный переключатель VK community bot runtime.</div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, enabled: Boolean(checked) } : prev))}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">VK group ID</label>
              <Input value={settings.groupId} onChange={(event) => setSettings((prev) => (prev ? { ...prev, groupId: event.target.value } : prev))} placeholder="-123456789" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">VK access token</label>
              <Input value={settings.accessToken} onChange={(event) => setSettings((prev) => (prev ? { ...prev, accessToken: event.target.value } : prev))} placeholder="vk1.a..." />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Telegram mirror chat ID</label>
              <Input value={settings.telegramMirrorChatId} onChange={(event) => setSettings((prev) => (prev ? { ...prev, telegramMirrorChatId: event.target.value } : prev))} placeholder="-1001234567890" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Long poll wait seconds</label>
              <Input type="number" min={1} max={90} value={settings.longPollWaitSeconds} onChange={(event) => setSettings((prev) => (prev ? { ...prev, longPollWaitSeconds: Number(event.target.value || 25) || 25 } : prev))} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">Новости</div>
                <div className="text-xs text-gray-500">Публиковать новости в VK при отправке из редактора.</div>
              </div>
              <Switch checked={settings.sync.news} onCheckedChange={(checked) => updateSync("news", Boolean(checked))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">Ивенты</div>
                <div className="text-xs text-gray-500">Публиковать события (Events) в VK при создании/обновлении.</div>
              </div>
              <Switch checked={Boolean(settings.sync.events)} onCheckedChange={(checked) => updateSync("events", Boolean(checked))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">NOTAMы</div>
                <div className="text-xs text-gray-500">Публиковать NOTAMы в VK при создании/обновлении.</div>
              </div>
              <Switch checked={Boolean(settings.sync.notams)} onCheckedChange={(checked) => updateSync("notams", Boolean(checked))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">Алерты</div>
                <div className="text-xs text-gray-500">Публиковать системные алерты в VK при создании/обновлении.</div>
              </div>
              <Switch checked={Boolean(settings.sync.alerts)} onCheckedChange={(checked) => updateSync("alerts", Boolean(checked))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">Telegram mirror</div>
                <div className="text-xs text-gray-500">Дублировать VK-посты в Telegram chat/channel.</div>
              </div>
              <Switch checked={settings.sync.telegramMirror} onCheckedChange={(checked) => updateSync("telegramMirror", Boolean(checked))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">FAQ engine</div>
                <div className="text-xs text-gray-500">Включить автоответы по FAQ.</div>
              </div>
              <Switch checked={settings.faqEnabled} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, faqEnabled: Boolean(checked) } : prev))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-medium text-gray-900">Menu engine</div>
                <div className="text-xs text-gray-500">Показывать меню сообщества по команде и по старту.</div>
              </div>
              <Switch checked={settings.menuEnabled} onCheckedChange={(checked) => setSettings((prev) => (prev ? { ...prev, menuEnabled: Boolean(checked) } : prev))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Welcome message</label>
            <Textarea value={settings.welcomeMessage} onChange={(event) => setSettings((prev) => (prev ? { ...prev, welcomeMessage: event.target.value } : prev))} className="min-h-28" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Fallback message</label>
            <Textarea value={settings.fallbackMessage} onChange={(event) => setSettings((prev) => (prev ? { ...prev, fallbackMessage: event.target.value } : prev))} className="min-h-28" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Menu title</label>
            <Input value={settings.menuTitle} onChange={(event) => setSettings((prev) => (prev ? { ...prev, menuTitle: event.target.value } : prev))} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Auto message: start</label>
              <Textarea
                value={settings.autoMessages?.start || ""}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, autoMessages: { ...(prev.autoMessages || { start: "", menu: "", faqMiss: "" }), start: event.target.value } }
                      : prev
                  )
                }
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Auto message: menu</label>
              <Textarea
                value={settings.autoMessages?.menu || ""}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, autoMessages: { ...(prev.autoMessages || { start: "", menu: "", faqMiss: "" }), menu: event.target.value } }
                      : prev
                  )
                }
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Auto message: fallback</label>
              <Textarea
                value={settings.autoMessages?.faqMiss || ""}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, autoMessages: { ...(prev.autoMessages || { start: "", menu: "", faqMiss: "" }), faqMiss: event.target.value } }
                      : prev
                  )
                }
                className="min-h-24"
              />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
            All service messages are configurable here: welcome, fallback, menu title, auto messages, FAQ and user reply templates.
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Announcement templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
            Supported placeholders: {"{{title}}"}, {"{{content}}"}, {"{{category}}"}, {"{{author}}"}, {"{{link}}"}, {"{{linkLine}}"}.
          </div>
          <div className="space-y-4">
            {templateKeys.map((templateId) => {
              const meta = VK_ANNOUNCEMENT_TEMPLATE_META.find((item) => item.id === templateId);
              const template = settings.announcementTemplates?.[templateId] || {
                id: templateId,
                title: meta?.label || templateId,
                enabled: true,
                text: "",
              };

              return (
                <div key={templateId} className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{meta?.label || template.title || templateId}</div>
                      <div className="text-xs text-gray-500">{meta?.description || "Custom VK announcement template"}</div>
                    </div>
                    <Switch
                      checked={Boolean(template.enabled)}
                      onCheckedChange={(checked) => updateAnnouncementTemplate(templateId, { enabled: Boolean(checked) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Template title</label>
                    <Input
                      value={template.title || ""}
                      onChange={(event) => updateAnnouncementTemplate(templateId, { title: event.target.value })}
                      placeholder="Template name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Template body</label>
                    <Textarea
                      value={template.text || ""}
                      onChange={(event) => updateAnnouncementTemplate(templateId, { text: event.target.value })}
                      className="min-h-36 font-mono text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">FAQ items JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={faqJson} onChange={(event) => setFaqJson(event.target.value)} className="min-h-[360px] font-mono text-xs" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Menu items JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={menuJson} onChange={(event) => setMenuJson(event.target.value)} className="min-h-[360px] font-mono text-xs" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Reply templates JSON</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-gray-500">
              Fields: id, title, matchMode (contains|exact|regex), trigger, response, enabled, order. Placeholders: {"{{message}}"}, {"{{userId}}"}, {"{{peerId}}"}, {"{{websiteUrl}}"}.
            </div>
            <Textarea value={replyTemplatesJson} onChange={(event) => setReplyTemplatesJson(event.target.value)} className="min-h-[340px] font-mono text-xs" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Dialog menu JSON</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-gray-500">
              Configure in-dialog keyboard menu. Root fields: enabled, oneTime, inline, buttons[]. Button fields: id, label, type (text|url|faq|menu), value, enabled, order.
            </div>
            <Textarea value={dialogMenuJson} onChange={(event) => setDialogMenuJson(event.target.value)} className="min-h-[340px] font-mono text-xs" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Bot notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            This bot is a separate runtime. It reads config from backend, polls VK long poll, answers FAQ/menu requests, and can mirror news to Telegram.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            Use JSON editors for FAQ/menu/replies/dialog keyboard. Keep stable ids so the runtime can map FAQ buttons and user reply templates.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
