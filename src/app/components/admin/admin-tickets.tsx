import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, RefreshCw, Save, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { useLanguage } from "../../context/language-context";

interface TicketModalField {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  style?: 1 | 2;
}

interface TicketConfigItem {
  id: string;
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  buttonStyle?: 1 | 2 | 3 | 4;
  threadChannelId?: string;
  roleIds?: string[];
  modalFields?: TicketModalField[];
  enabled?: boolean;
  order?: number;
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
}

interface GuildRole {
  id: string;
  name: string;
  color: number;
}

interface TicketConfig {
  enabled: boolean;
  categories: TicketConfigItem[];
  tags: TicketConfigItem[];
  assignees: TicketConfigItem[];
}

interface RouteReportBlockedPilot {
  pilotId?: number | null;
  username?: string | null;
  name?: string | null;
  reason?: string | null;
  blockedAt?: string;
}

interface RouteReportSettings {
  cooldownMinutes: number;
  dailyLimit: number;
  blockedPilots: RouteReportBlockedPilot[];
}

interface TicketMessage {
  id: string;
  authorRole: "pilot" | "staff";
  authorName: string;
  content: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  number: number;
  subject: string;
  categoryId: string;
  categoryName: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  tags: string[];
  assigneeId?: string | null;
  assigneeName?: string | null;
  unreadByStaff: number;
  unreadByOwner: number;
  owner?: { name?: string; username?: string };
  messages: TicketMessage[];
  updatedAt: string;
}

const statusBadgeClass: Record<Ticket["status"], string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-sky-200 bg-sky-50 text-sky-700",
  closed: "border-gray-200 bg-gray-50 text-gray-700",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const BUTTON_STYLES = [
  { value: 1, label: "Primary (синяя)", color: "#5865F2" },
  { value: 2, label: "Secondary (серая)", color: "#4E5058" },
  { value: 3, label: "Success (зелёная)", color: "#57F287" },
  { value: 4, label: "Danger (красная)", color: "#ED4245" },
];

export function AdminTickets() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [config, setConfig] = useState<TicketConfig>({ enabled: true, categories: [], tags: [], assignees: [] });
  const [reply, setReply] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [guildChannels, setGuildChannels] = useState<GuildChannel[]>([]);
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);

  // New item forms
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newAssigneeName, setNewAssigneeName] = useState("");

  // Route report moderation
  const [reportSettings, setReportSettings] = useState<RouteReportSettings>({ cooldownMinutes: 30, dailyLimit: 5, blockedPilots: [] });
  const [isSavingReportSettings, setIsSavingReportSettings] = useState(false);
  const [newBlockUsername, setNewBlockUsername] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configRes, ticketsRes, reportSettingsRes, guildRes] = await Promise.all([
        fetch("/api/admin/tickets/config", { credentials: "include" }),
        fetch("/api/admin/tickets", { credentials: "include" }),
        fetch("/api/admin/route-reports/settings", { credentials: "include" }),
        fetch("/api/admin/discord-bot/guild", { credentials: "include" }),
      ]);
      const guildPayload = guildRes.ok ? await guildRes.json() : null;
      if (guildPayload) {
        const textChannelTypes = [0, 5, 10, 11, 12, 15];
        setGuildChannels((guildPayload.channels || []).filter((c: GuildChannel) => textChannelTypes.includes(c.type)));
        setGuildRoles((guildPayload.roles || []).filter((r: GuildRole) => r.name !== "@everyone"));
      }

      const configPayload = configRes.ok ? await configRes.json() : {};
      const ticketPayload = ticketsRes.ok ? await ticketsRes.json() : {};
      const reportSettingsPayload = reportSettingsRes.ok ? await reportSettingsRes.json() : {};
      if (reportSettingsPayload?.settings) {
        setReportSettings({
          cooldownMinutes: Number(reportSettingsPayload.settings.cooldownMinutes ?? 30),
          dailyLimit: Number(reportSettingsPayload.settings.dailyLimit ?? 5),
          blockedPilots: Array.isArray(reportSettingsPayload.settings.blockedPilots) ? reportSettingsPayload.settings.blockedPilots : [],
        });
      }

      const nextConfig = configPayload?.ticketConfig;
      const nextTickets = Array.isArray(ticketPayload?.tickets) ? ticketPayload.tickets : [];

      setConfig({
        enabled: Boolean(nextConfig?.enabled ?? true),
        categories: Array.isArray(nextConfig?.categories) ? nextConfig.categories : [],
        tags: Array.isArray(nextConfig?.tags) ? nextConfig.tags : [],
        assignees: Array.isArray(nextConfig?.assignees) ? nextConfig.assignees : [],
      });
      setTickets(nextTickets);

      if (!selectedTicketId && nextTickets.length > 0) {
        setSelectedTicketId(String(nextTickets[0].id || ""));
      }
      if (selectedTicketId && !nextTickets.some((item: Ticket) => item.id === selectedTicketId)) {
        setSelectedTicketId(nextTickets[0]?.id || "");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((item) => item.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    setTagDraft(selectedTicket?.tags?.join(", ") || "");
  }, [selectedTicket]);

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await fetch("/api/admin/tickets/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      await loadData();
    } finally {
      setIsSavingConfig(false);
    }
  };

  const updateCategory = (index: number, patch: Partial<TicketConfigItem>) => {
    setConfig((prev) => {
      const next = [...prev.categories];
      next[index] = { ...next[index], ...patch };
      return { ...prev, categories: next };
    });
  };

  const updateCategoryModalField = (catIndex: number, fieldIndex: number, patch: Partial<TicketModalField>) => {
    setConfig((prev) => {
      const cats = [...prev.categories];
      const fields = [...(cats[catIndex].modalFields || [])];
      fields[fieldIndex] = { ...fields[fieldIndex], ...patch };
      cats[catIndex] = { ...cats[catIndex], modalFields: fields };
      return { ...prev, categories: cats };
    });
  };

  const addCategoryModalField = (catIndex: number) => {
    setConfig((prev) => {
      const cats = [...prev.categories];
      const fields = [...(cats[catIndex].modalFields || [])];
      if (fields.length >= 5) return prev;
      fields.push({ id: `field-${Date.now()}`, label: "Новое поле", required: false, style: 1 });
      cats[catIndex] = { ...cats[catIndex], modalFields: fields };
      return { ...prev, categories: cats };
    });
  };

  const removeCategoryModalField = (catIndex: number, fieldIndex: number) => {
    setConfig((prev) => {
      const cats = [...prev.categories];
      const fields = (cats[catIndex].modalFields || []).filter((_, i) => i !== fieldIndex);
      cats[catIndex] = { ...cats[catIndex], modalFields: fields };
      return { ...prev, categories: cats };
    });
  };

  const toggleCategoryRole = (catIndex: number, roleId: string) => {
    setConfig((prev) => {
      const cats = [...prev.categories];
      const roles = new Set(cats[catIndex].roleIds || []);
      if (roles.has(roleId)) roles.delete(roleId); else roles.add(roleId);
      cats[catIndex] = { ...cats[catIndex], roleIds: Array.from(roles) };
      return { ...prev, categories: cats };
    });
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) return;
    const newItem: TicketConfigItem = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      emoji: "🎫",
      buttonStyle: 1,
      color: "#E31E24",
      threadChannelId: "",
      roleIds: [],
      modalFields: [
        { id: "subject", label: "Тема обращения", required: true, style: 1 },
        { id: "description", label: "Описание", required: true, style: 2 },
      ],
      enabled: true,
    };
    setConfig((prev) => ({ ...prev, categories: [...prev.categories, newItem] }));
    setNewCategoryName("");
    setExpandedCategoryId(newItem.id);
  };

  const addNewTag = () => {
    if (!newTagName.trim()) return;
    const newItem: TicketConfigItem = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      enabled: true,
    };
    setConfig((prev) => ({ ...prev, tags: [...prev.tags, newItem] }));
    setNewTagName("");
  };

  const addNewAssignee = () => {
    if (!newAssigneeName.trim()) return;
    const newItem: TicketConfigItem = {
      id: `asgn-${Date.now()}`,
      name: newAssigneeName.trim(),
      enabled: true,
    };
    setConfig((prev) => ({ ...prev, assignees: [...prev.assignees, newItem] }));
    setNewAssigneeName("");
  };

  const saveReportSettings = async (next?: RouteReportSettings) => {
    const payload = next || reportSettings;
    setIsSavingReportSettings(true);
    try {
      const res = await fetch("/api/admin/route-reports/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.settings) {
        setReportSettings({
          cooldownMinutes: Number(data.settings.cooldownMinutes ?? payload.cooldownMinutes),
          dailyLimit: Number(data.settings.dailyLimit ?? payload.dailyLimit),
          blockedPilots: Array.isArray(data.settings.blockedPilots) ? data.settings.blockedPilots : payload.blockedPilots,
        });
      }
    } finally {
      setIsSavingReportSettings(false);
    }
  };

  const addBlockedPilot = () => {
    const username = newBlockUsername.trim();
    if (!username) return;
    const next = {
      ...reportSettings,
      blockedPilots: [
        ...reportSettings.blockedPilots,
        { username, reason: newBlockReason.trim() || null, blockedAt: new Date().toISOString() },
      ],
    };
    setReportSettings(next);
    setNewBlockUsername("");
    setNewBlockReason("");
    void saveReportSettings(next);
  };

  const removeBlockedPilot = (index: number) => {
    const next = { ...reportSettings, blockedPilots: reportSettings.blockedPilots.filter((_, i) => i !== index) };
    setReportSettings(next);
    void saveReportSettings(next);
  };

  const deleteConfigItem = (type: "categories" | "tags" | "assignees", id: string) => {
    setConfig((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== id),
    }));
  };

  const updateTicket = async (patch: Partial<Ticket>) => {
    if (!selectedTicket) {
      return;
    }

    setIsUpdatingTicket(true);
    try {
      await fetch(`/api/admin/tickets/${encodeURIComponent(selectedTicket.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadData();
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) {
      return;
    }

    setIsSendingReply(true);
    try {
      await fetch(`/api/admin/tickets/${encodeURIComponent(selectedTicket.id)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      setReply("");
      await loadData();
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tr("Тикеты", "Tickets")}</h2>
          <p className="text-sm text-gray-500">{tr("Отслеживайте тикеты пилотов и управляйте категориями, тегами и исполнителями.", "Track pilot tickets and manage categories, tags, and assignees.")}</p>
        </div>
        <Button variant="outline" onClick={() => loadData()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {tr("Обновить", "Refresh")}
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr("Настройки тикетов", "Ticket Settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <div className="font-medium text-gray-900">{tr("Система тикетов включена", "Ticket system enabled")}</div>
              <div className="text-xs text-gray-500">{tr("Отключите, чтобы запретить создание новых тикетов с сайта.", "Disable to prevent new tickets from being created on the site.")}</div>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: Boolean(checked) }))} />
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">{tr("Категории тикетов", "Ticket Categories")}</div>
              <div className="text-xs text-gray-500">{tr("Настройте внешний вид кнопок Discord и поля модальных форм для каждой категории.", "Configure Discord button appearance and modal fields per category.")}</div>
              {config.categories.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
                    onClick={() => setExpandedCategoryId(expandedCategoryId === item.id ? null : item.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.emoji && <span className="text-base">{item.emoji}</span>}
                      <span className="font-medium text-sm text-gray-900 truncate">{item.name}</span>
                      {!item.enabled && <Badge variant="outline" className="text-xs text-gray-400">off</Badge>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: BUTTON_STYLES.find(s => s.value === (item.buttonStyle || 1))?.color || "#5865F2" }} />
                      <button className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteConfigItem("categories", item.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {expandedCategoryId === item.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>

                  {expandedCategoryId === item.id && (
                    <div className="p-3 space-y-3 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("Название", "Name")}</div>
                          <Input value={item.name} onChange={(e) => updateCategory(index, { name: e.target.value })} />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("Emoji кнопки", "Button emoji")}</div>
                          <Input value={item.emoji || ""} onChange={(e) => updateCategory(index, { emoji: e.target.value })} placeholder="🎫" maxLength={4} />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("Стиль кнопки Discord", "Discord button style")}</div>
                          <Select value={String(item.buttonStyle || 1)} onValueChange={(v) => updateCategory(index, { buttonStyle: Number(v) as TicketConfigItem["buttonStyle"] })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BUTTON_STYLES.map((s) => (
                                <SelectItem key={s.value} value={String(s.value)}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                                    {s.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("Цвет (embed)", "Color (embed)")}</div>
                          <Input type="color" value={item.color || "#E31E24"} onChange={(e) => updateCategory(index, { color: e.target.value })} className="h-10 cursor-pointer" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("Канал для веток (ID)", "Thread channel (ID)")}</div>
                          {guildChannels.length > 0 ? (
                            <Select value={item.threadChannelId || "__default"} onValueChange={(v) => updateCategory(index, { threadChannelId: v === "__default" ? "" : v })}>
                              <SelectTrigger><SelectValue placeholder={tr("По умолчанию", "Default")} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__default">{tr("По умолчанию (из настроек панели)", "Default (from panel settings)")}</SelectItem>
                                {guildChannels.map((ch) => <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={item.threadChannelId || ""} onChange={(e) => updateCategory(index, { threadChannelId: e.target.value })} placeholder={tr("ID канала (опционально)", "Channel ID (optional)")} />
                          )}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                          <div className="text-sm text-gray-700">{tr("Активна", "Enabled")}</div>
                          <Switch checked={Boolean(item.enabled)} onCheckedChange={(checked) => updateCategory(index, { enabled: Boolean(checked) })} />
                        </div>
                      </div>

                      {guildRoles.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("Роли для уведомления в ветке", "Roles to mention in thread")}</div>
                          <div className="flex flex-wrap gap-2">
                            {guildRoles.map((role) => {
                              const isSelected = (item.roleIds || []).includes(role.id);
                              const hexColor = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#6b7280";
                              return (
                                <button
                                  key={role.id}
                                  onClick={() => toggleCategoryRole(index, role.id)}
                                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${isSelected ? "border-transparent text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                                  style={isSelected ? { backgroundColor: hexColor } : {}}
                                >
                                  @{role.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!guildRoles.length && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{tr("ID ролей для уведомления (через запятую)", "Role IDs to mention (comma-separated)")}</div>
                          <Input
                            value={(item.roleIds || []).join(", ")}
                            onChange={(e) => updateCategory(index, { roleIds: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                            placeholder="123456789, 987654321"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-gray-500">{tr("Поля модалки (макс. 5)", "Modal fields (max 5)")}</div>
                          {(item.modalFields || []).length < 5 && (
                            <button className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1" onClick={() => addCategoryModalField(index)}>
                              <Plus className="h-3 w-3" /> {tr("Добавить поле", "Add field")}
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {(item.modalFields || []).map((field, fi) => (
                            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center rounded border border-gray-100 p-2 bg-gray-50">
                              <Input
                                value={field.label}
                                onChange={(e) => updateCategoryModalField(index, fi, { label: e.target.value })}
                                placeholder={tr("Название поля", "Field label")}
                                className="text-sm"
                              />
                              <Input
                                value={field.placeholder || ""}
                                onChange={(e) => updateCategoryModalField(index, fi, { placeholder: e.target.value })}
                                placeholder={tr("Подсказка (placeholder)", "Placeholder")}
                                className="text-sm"
                              />
                              <Select value={String(field.style || 1)} onValueChange={(v) => updateCategoryModalField(index, fi, { style: Number(v) as 1 | 2 })}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">{tr("Строка", "Short")}</SelectItem>
                                  <SelectItem value="2">{tr("Абзац", "Paragraph")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Switch checked={field.required !== false} onCheckedChange={(v) => updateCategoryModalField(index, fi, { required: v })} />
                                <span>{tr("Обяз.", "Req.")}</span>
                              </div>
                              <button className="text-red-400 hover:text-red-600" onClick={() => removeCategoryModalField(index, fi)}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          {(item.modalFields || []).length === 0 && (
                            <div className="text-xs text-gray-400 text-center py-2">{tr("Нет полей — добавьте хотя бы одно.", "No fields — add at least one.")}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={tr("Новая категория...", "New category...")}
                  onKeyDown={(e) => e.key === "Enter" && addNewCategory()}
                />
                <Button variant="outline" size="sm" onClick={addNewCategory} disabled={!newCategoryName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">{tr("Теги", "Tags")}</div>
              {config.tags.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const next = [...config.tags];
                      next[index] = { ...item, name: e.target.value };
                      setConfig((prev) => ({ ...prev, tags: next }));
                    }}
                  />
                  <Switch
                    checked={Boolean(item.enabled)}
                    onCheckedChange={(checked) => {
                      const next = [...config.tags];
                      next[index] = { ...item, enabled: Boolean(checked) };
                      setConfig((prev) => ({ ...prev, tags: next }));
                    }}
                  />
                  <button
                    className="text-red-400 hover:text-red-600"
                    onClick={() => deleteConfigItem("tags", item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={tr("Новый тег...", "New tag...")}
                  onKeyDown={(e) => e.key === "Enter" && addNewTag()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewTag}
                  disabled={!newTagName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">{tr("Исполнители", "Assignees")}</div>
              {config.assignees.length === 0 && !newAssigneeName ? (
                <div className="text-sm text-gray-500">{tr("Исполнители не настроены", "No assignees configured")}</div>
              ) : (
                config.assignees.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => {
                        const next = [...config.assignees];
                        next[index] = { ...item, name: e.target.value };
                        setConfig((prev) => ({ ...prev, assignees: next }));
                      }}
                    />
                    <Switch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={(checked) => {
                        const next = [...config.assignees];
                        next[index] = { ...item, enabled: Boolean(checked) };
                        setConfig((prev) => ({ ...prev, assignees: next }));
                      }}
                    />
                    <button
                      className="text-red-400 hover:text-red-600"
                      onClick={() => deleteConfigItem("assignees", item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-2">
                <Input
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  placeholder={tr("Новый исполнитель...", "New assignee...")}
                  onKeyDown={(e) => e.key === "Enter" && addNewAssignee()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewAssignee}
                  disabled={!newAssigneeName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={isSavingConfig} className="bg-[#E31E24] hover:bg-[#c91a1f]">
              {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {tr("Сохранить конфигурацию", "Save configuration")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr("Модерация репортов маршрутов", "Route Report Moderation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-1">{tr("Кулдаун между репортами (мин)", "Cooldown between reports (min)")}</div>
              <div className="text-xs text-gray-500 mb-2">{tr("0 — без кулдауна. Не действует на повторный репорт того же маршрута (он считается дубликатом).", "0 — no cooldown. Doesn't apply to re-reporting the same route (treated as a duplicate).")}</div>
              <Input
                type="number"
                min={0}
                max={1440}
                value={reportSettings.cooldownMinutes}
                onChange={(e) => setReportSettings((prev) => ({ ...prev, cooldownMinutes: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-1">{tr("Лимит репортов за 24 часа", "Reports limit per 24 hours")}</div>
              <div className="text-xs text-gray-500 mb-2">{tr("0 — без лимита.", "0 — unlimited.")}</div>
              <Input
                type="number"
                min={0}
                max={100}
                value={reportSettings.dailyLimit}
                onChange={(e) => setReportSettings((prev) => ({ ...prev, dailyLimit: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="text-sm font-semibold text-gray-700">{tr("Заблокированные пилоты", "Blocked pilots")}</div>
            <div className="text-xs text-gray-500">{tr("Пилоты из списка не смогут отправлять репорты о маршрутах.", "Pilots on this list cannot submit route reports.")}</div>
            {reportSettings.blockedPilots.length === 0 ? (
              <div className="text-sm text-gray-400 py-1">{tr("Список пуст.", "List is empty.")}</div>
            ) : (
              reportSettings.blockedPilots.map((pilot, index) => (
                <div key={`${pilot.username || pilot.pilotId}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <span className="font-medium text-sm text-gray-900">{pilot.name || pilot.username || `Pilot #${pilot.pilotId}`}</span>
                    {pilot.username ? <span className="ml-2 text-xs text-gray-500 font-mono">{pilot.username}</span> : null}
                    {pilot.reason ? <span className="ml-2 text-xs text-gray-400">— {pilot.reason}</span> : null}
                  </div>
                  <button className="text-red-400 hover:text-red-600 shrink-0" onClick={() => removeBlockedPilot(index)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newBlockUsername}
                onChange={(e) => setNewBlockUsername(e.target.value)}
                placeholder={tr("Username пилота (vAMSYS)...", "Pilot username (vAMSYS)...")}
                onKeyDown={(e) => e.key === "Enter" && addBlockedPilot()}
              />
              <Input
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder={tr("Причина (необязательно)...", "Reason (optional)...")}
                onKeyDown={(e) => e.key === "Enter" && addBlockedPilot()}
              />
              <Button variant="outline" onClick={addBlockedPilot} disabled={!newBlockUsername.trim() || isSavingReportSettings}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveReportSettings()} disabled={isSavingReportSettings} className="bg-[#E31E24] hover:bg-[#c91a1f]">
              {isSavingReportSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {tr("Сохранить настройки репортов", "Save report settings")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{tr("Очередь тикетов", "Ticket Queue")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[640px] overflow-auto">
            {isLoading ? (
              <div className="text-sm text-gray-500 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> {tr("Загрузка...", "Loading...")}</div>
            ) : tickets.length === 0 ? (
              <div className="text-sm text-gray-500">{tr("Тикеты не найдены.", "No tickets found.")}</div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  className={`w-full text-left rounded-lg border p-3 hover:bg-gray-50 ${selectedTicketId === ticket.id ? "border-[#E31E24] bg-red-50/40" : "border-gray-200"}`}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm text-gray-900 truncate">#{ticket.number} {ticket.subject}</div>
                    {ticket.unreadByStaff > 0 ? <Badge className="bg-[#E31E24]">{ticket.unreadByStaff}</Badge> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <Badge variant="outline" className={statusBadgeClass[ticket.status]}>{ticket.status}</Badge>
                    <span className="text-gray-400">{formatDateTime(ticket.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-8 border-none shadow-sm">
          {selectedTicket ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">#{selectedTicket.number} {selectedTicket.subject}</CardTitle>
                    <div className="text-sm text-gray-500 mt-1">{selectedTicket.owner?.name || tr("Пилот", "Pilot")} ({selectedTicket.owner?.username || tr("неизвестно", "unknown")})</div>
                  </div>
                  <Badge variant="outline" className={statusBadgeClass[selectedTicket.status]}>{selectedTicket.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select value={selectedTicket.status} onValueChange={(value) => updateTicket({ status: value as Ticket["status"] })}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Статус", "Status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{tr("Открыт", "Open")}</SelectItem>
                      <SelectItem value="in_progress">{tr("В работе", "In progress")}</SelectItem>
                      <SelectItem value="resolved">{tr("Решён", "Resolved")}</SelectItem>
                      <SelectItem value="closed">{tr("Закрыт", "Closed")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.priority} onValueChange={(value) => updateTicket({ priority: value as Ticket["priority"] })}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Приоритет", "Priority")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{tr("Низкий", "Low")}</SelectItem>
                      <SelectItem value="normal">{tr("Обычный", "Normal")}</SelectItem>
                      <SelectItem value="high">{tr("Высокий", "High")}</SelectItem>
                      <SelectItem value="critical">{tr("Критический", "Critical")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.categoryId} onValueChange={(value) => updateTicket({ categoryId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Категория", "Category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {config.categories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.assigneeId || "none"} onValueChange={(value) => updateTicket({ assigneeId: value === "none" ? null : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Исполнитель", "Assignee")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr("Не назначен", "Unassigned")}</SelectItem>
                      {config.assignees.filter((item) => Boolean(item.enabled)).map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder={tr("Теги тикета (через запятую)", "Ticket tags (comma-separated)")}
                  />
                  <Button
                    variant="outline"
                    disabled={isUpdatingTicket}
                    onClick={() => {
                      const nextTags = tagDraft
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean);
                      updateTicket({ tags: nextTags });
                    }}
                  >
                    {tr("Применить теги", "Apply tags")}
                  </Button>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3 max-h-[320px] overflow-auto">
                  {selectedTicket.messages.map((msg) => (
                    <div key={msg.id} className={`rounded-lg border p-3 ${msg.authorRole === "staff" ? "border-sky-200 bg-sky-50" : "border-gray-200 bg-white"}`}>
                      <div className="text-xs text-gray-500 flex items-center justify-between">
                        <span>{msg.authorName} ({msg.authorRole})</span>
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{msg.content}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tr("Ответ от лица staff", "Reply as staff")} rows={4} />
                  <Button onClick={sendReply} disabled={isSendingReply || isUpdatingTicket} className="bg-[#E31E24] hover:bg-[#c91a1f]">
                    {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    {tr("Отправить ответ", "Send reply")}
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="min-h-[500px] flex items-center justify-center text-gray-500">
              {tr("Выберите тикет для модерации.", "Select a ticket to moderate.")}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
