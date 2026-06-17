import { useEffect, useState } from "react";
import { Mail, Send, Plus, Users, Upload, FlaskConical, RefreshCw, CheckCircle2, AlertTriangle, FileText, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "../../context/language-context";

interface Campaign {
  id: string;
  subject: string;
  html: string;
  status: "draft" | "sending" | "sent";
  createdAt: string;
  sentAt: string | null;
  stats: { total: number; sent: number; failed: number };
}
interface Status {
  provider: string;
  ready: boolean;
  from: string;
  audienceCount: number;
  unsubscribedCount: number;
  importedCount: number;
  consent?: {
    apiProvidesConsent: boolean;
    withConsentField: number;
    consented: number;
    activeEmails: number;
  };
  list?: {
    lastImportedAt: string | null;
    ageDays: number | null;
    refreshDays: number;
    needsRefresh: boolean;
    lastDiff: { added: number; removed: number; total: number; kept: number; at: string } | null;
  };
}

interface ImportDiff {
  added: number;
  removed: number;
  total: number;
  kept: number;
  at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  preset?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function AdminEmail() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [status, setStatus] = useState<Status | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [importList, setImportList] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<ImportDiff | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [presets, setPresets] = useState<EmailTemplate[]>([]);

  const loadStatus = async () => {
    try {
      const r = await fetch("/api/admin/email/status", { credentials: "include" });
      if (r.ok) setStatus(await r.json());
    } catch {
      /* ignore */
    }
  };
  const loadCampaigns = async () => {
    try {
      const r = await fetch("/api/admin/email/campaigns", { credentials: "include" });
      if (r.ok) setCampaigns((await r.json()).campaigns || []);
    } catch {
      /* ignore */
    }
  };

  const loadTemplates = async () => {
    try {
      const r = await fetch("/api/admin/email/templates", { credentials: "include" });
      if (r.ok) {
        const p = await r.json();
        setTemplates(Array.isArray(p?.templates) ? p.templates : []);
        setPresets(Array.isArray(p?.presets) ? p.presets : []);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadStatus();
    void loadCampaigns();
    void loadTemplates();
    const id = window.setInterval(loadCampaigns, 5000); // обновлять статистику отправки
    return () => window.clearInterval(id);
  }, []);

  const applyTemplate = (t: EmailTemplate) => {
    setSubject(t.subject);
    setHtml(t.html);
    toast.success(tr(`Шаблон «${t.name}» применён`, `Template "${t.name}" applied`));
  };

  const saveAsTemplate = async () => {
    if (!subject.trim() && !html.trim()) return toast.error(tr("Сначала заполните тему/HTML", "Fill subject/HTML first"));
    const name = window.prompt(tr("Название шаблона:", "Template name:"))?.trim();
    if (!name) return;
    const r = await fetch("/api/admin/email/templates", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, html }),
    });
    if (r.ok) {
      toast.success(tr("Шаблон сохранён", "Template saved"));
      void loadTemplates();
    } else toast.error(tr("Ошибка", "Error"));
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm(tr("Удалить шаблон?", "Delete template?"))) return;
    const r = await fetch(`/api/admin/email/templates/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      toast.success(tr("Удалено", "Deleted"));
      void loadTemplates();
    } else toast.error(tr("Ошибка", "Error"));
  };

  const createCampaign = async () => {
    if (!subject.trim()) return toast.error(tr("Укажите тему", "Subject required"));
    const r = await fetch("/api/admin/email/campaigns", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, html }),
    });
    if (r.ok) {
      const p = await r.json();
      setActiveId(p.campaign.id);
      setSubject("");
      setHtml("");
      toast.success(tr("Черновик создан", "Draft created"));
      void loadCampaigns();
    } else toast.error(tr("Ошибка", "Error"));
  };

  const previewImport = async () => {
    if (!importList.trim()) return toast.error(tr("Загрузите CSV", "Load a CSV"));
    const r = await fetch("/api/admin/email/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list: importList, mode: "preview" }),
    });
    if (r.ok) setPreview((await r.json()).diff);
    else toast.error(tr("Ошибка", "Error"));
  };

  const applyImport = async () => {
    const r = await fetch("/api/admin/email/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list: importList, mode: "apply" }),
    });
    if (r.ok) {
      const p = await r.json();
      toast.success(tr(`База обновлена: +${p.diff.added} / −${p.diff.removed}, всего ${p.total}`, `List synced: +${p.diff.added} / −${p.diff.removed}, total ${p.total}`));
      setImportList("");
      setImportFileName("");
      setPreview(null);
      void loadStatus();
    } else toast.error(tr("Ошибка импорта", "Import error"));
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImportList(String(reader.result || ""));
      setImportFileName(file.name);
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const test = async (id: string) => {
    if (!testEmail.trim()) return toast.error(tr("Укажите email", "Email required"));
    const r = await fetch(`/api/admin/email/campaigns/${id}/test`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });
    if (r.ok) toast.success(tr("Тест отправлен", "Test sent"));
    else toast.error((await r.json().catch(() => null))?.error || tr("Ошибка", "Error"));
  };

  const send = async (id: string) => {
    if (!window.confirm(tr(`Отправить рассылку на ${status?.audienceCount ?? 0} адресов?`, `Send to ${status?.audienceCount ?? 0} recipients?`))) return;
    const r = await fetch(`/api/admin/email/campaigns/${id}/send`, { method: "POST", credentials: "include" });
    if (r.ok) {
      toast.success(tr("Рассылка запущена", "Campaign started"));
      void loadCampaigns();
    } else toast.error((await r.json().catch(() => null))?.error || tr("Ошибка", "Error"));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Mail className="h-5 w-5 text-[#E31E24]" />
          {tr("Email-рассылки", "Email campaigns")}
        </h1>
        <Button variant="outline" onClick={() => { void loadStatus(); void loadCampaigns(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {tr("Обновить", "Reload")}
        </Button>
      </div>

      {/* Напоминание обновить базу раз в N дней */}
      {status?.list?.needsRefresh ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {status.list.lastImportedAt
              ? tr(
                  `База не обновлялась ${status.list.ageDays} дн. Пора обновить (рекомендуется раз в ${status.list.refreshDays} дн.) — выгрузите свежий список подписчиков из vAMSYS и импортируйте ниже.`,
                  `List hasn't been updated for ${status.list.ageDays} days. Time to refresh (every ${status.list.refreshDays} days) — export the latest subscribers from vAMSYS and import below.`
                )
              : tr(
                  "База ещё не загружалась. Выгрузите список подписчиков из vAMSYS и импортируйте ниже.",
                  "The list hasn't been imported yet. Export subscribers from vAMSYS and import below."
                )}
          </span>
        </div>
      ) : status?.list?.lastImportedAt ? (
        <div className="text-xs text-gray-400">
          {tr(
            `База обновлена ${status.list.ageDays} дн. назад. Следующее напоминание через ${Math.max(0, status.list.refreshDays - (status.list.ageDays ?? 0))} дн.`,
            `List updated ${status.list.ageDays} days ago. Next reminder in ${Math.max(0, status.list.refreshDays - (status.list.ageDays ?? 0))} days.`
          )}
        </div>
      ) : null}

      {/* Статус провайдера + аудитория */}
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            {status?.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
            <div>
              <div className="text-xs text-gray-400">{tr("Провайдер", "Provider")}</div>
              <div className="text-sm font-semibold">{status?.provider || "—"} {status?.ready ? "" : tr("(не настроен)", "(not set)")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            <div>
              <div className="text-xs text-gray-400">{tr("Аудитория", "Audience")}</div>
              <div className="text-sm font-semibold">{status?.audienceCount ?? "—"}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">{tr("Импортировано", "Imported")}</div>
            <div className="text-sm font-semibold">{status?.importedCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">{tr("Отписалось", "Unsubscribed")}</div>
            <div className="text-sm font-semibold">{status?.unsubscribedCount ?? 0}</div>
          </div>
        </CardContent>
      </Card>

      {/* Ответ на вопрос: отдаёт ли vAMSYS маркетинг-согласие */}
      {status?.consent ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-2">
              {status.consent.apiProvidesConsent ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              )}
              <div className="text-sm text-gray-700">
                {status.consent.apiProvidesConsent ? (
                  <>
                    {tr("vAMSYS отдаёт согласие на рассылку.", "vAMSYS provides marketing consent.")}{" "}
                    <span className="font-semibold">
                      {tr(
                        `Согласны: ${status.consent.consented} из ${status.consent.withConsentField} (всего активных с email: ${status.consent.activeEmails}).`,
                        `Consented: ${status.consent.consented} of ${status.consent.withConsentField} (active w/ email: ${status.consent.activeEmails}).`
                      )}
                    </span>{" "}
                    {tr("Рассылка пойдёт только согласившимся.", "Campaigns go only to consented pilots.")}
                  </>
                ) : (
                  <>
                    {tr(
                      "В API vAMSYS нет поля согласия на рассылку — базу маркетинга нужно вести вручную (импорт ниже).",
                      "vAMSYS API has no marketing-consent field — manage the list manually (import below)."
                    )}{" "}
                    <span className="font-semibold">
                      {tr(`Активных с email: ${status.consent.activeEmails}.`, `Active w/ email: ${status.consent.activeEmails}.`)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Синхронизация базы из CSV */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <Upload className="h-4 w-4" /> {tr("Обновление базы (CSV)", "Sync list (CSV)")}
          </h2>
          <p className="mb-3 text-xs text-gray-400">
            {tr(
              "CSV = полный список подписанных (email,Имя). Старая база заменяется; рассылка идёт только тем, кто в файле и не отписался.",
              "CSV = full list of subscribers (email,Name). Replaces the old list; campaigns go only to those in the file who haven't unsubscribed."
            )}
          </p>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
              dragOver ? "border-[#E31E24] bg-red-50 text-[#E31E24]" : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Upload className="h-5 w-5" />
            <span className="font-medium">
              {importFileName || tr("Перетащите CSV сюда или нажмите", "Drag CSV here or click")}
            </span>
            <span className="text-xs text-gray-400">{tr("формат: email,Имя", "format: email,Name")}</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>

          {importList ? (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" onClick={() => void previewImport()}>
                {tr("Сравнить с текущей базой", "Compare with current")}
              </Button>
              {preview ? (
                <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={() => void applyImport()}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {tr("Применить", "Apply")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-emerald-50 p-2 text-center">
                <div className="text-lg font-bold text-emerald-600">+{preview.added}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{tr("прибавилось", "added")}</div>
              </div>
              <div className="rounded-lg bg-red-50 p-2 text-center">
                <div className="text-lg font-bold text-red-600">−{preview.removed}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{tr("отписалось", "removed")}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <div className="text-lg font-bold text-gray-700">{preview.kept}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{tr("осталось", "kept")}</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-2 text-center">
                <div className="text-lg font-bold text-sky-600">{preview.total}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{tr("всего в CSV", "total in CSV")}</div>
              </div>
            </div>
          ) : null}

          {!preview && status?.list?.lastDiff ? (
            <div className="mt-3 text-xs text-gray-400">
              {tr(
                `Прошлая синхронизация: +${status.list.lastDiff.added} / −${status.list.lastDiff.removed}, всего ${status.list.lastDiff.total}.`,
                `Last sync: +${status.list.lastDiff.added} / −${status.list.lastDiff.removed}, total ${status.list.lastDiff.total}.`
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Шаблоны писем */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <FileText className="h-4 w-4" /> {tr("Шаблоны писем", "Email templates")}
          </h2>
          <p className="mb-3 text-xs text-gray-400">
            {tr(
              "Примените шаблон к новой кампании ниже — тема и HTML подставятся в форму.",
              "Apply a template to the new campaign below — subject and HTML fill the form."
            )}
          </p>

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{tr("Пресеты", "Presets")}</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyTemplate(p)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 hover:border-[#E31E24]/40 hover:bg-red-50"
              >
                <FileText className="h-3.5 w-3.5 text-[#E31E24]" />
                {p.name}
              </button>
            ))}
            {presets.length === 0 ? <span className="text-sm text-gray-400">—</span> : null}
          </div>

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{tr("Мои шаблоны", "My templates")}</div>
          <div className="space-y-2">
            {templates.length === 0 ? (
              <div className="text-sm text-gray-400">{tr("Сохранённых шаблонов пока нет", "No saved templates yet")}</div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-800">{t.name}</div>
                    <div className="truncate text-xs text-gray-400">{t.subject || tr("(без темы)", "(no subject)")}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => applyTemplate(t)}>
                      {tr("Применить", "Apply")}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => void deleteTemplate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Новая кампания */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <Plus className="h-4 w-4" /> {tr("Новая кампания", "New campaign")}
          </h2>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={tr("Тема письма", "Subject")} className="mb-2" />
          <Textarea value={html} onChange={(e) => setHtml(e.target.value)} className="min-h-[160px] font-mono text-xs" placeholder={tr("HTML письма. Плейсхолдеры: {{name}}, {{email}}, {{unsubscribe}}", "Email HTML. Placeholders: {{name}}, {{email}}, {{unsubscribe}}")} />
          <div className="mt-2 flex gap-2">
            <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={() => void createCampaign()}>
              <Plus className="mr-2 h-4 w-4" /> {tr("Создать черновик", "Create draft")}
            </Button>
            <Button variant="outline" onClick={() => void saveAsTemplate()}>
              <Save className="mr-2 h-4 w-4" /> {tr("Сохранить как шаблон", "Save as template")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Список кампаний */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{tr("Кампании", "Campaigns")}</h2>
          <div className="mb-3 flex gap-2">
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder={tr("Email для теста", "Test email")} className="max-w-xs" />
          </div>
          <div className="space-y-2">
            {campaigns.length === 0 ? (
              <div className="text-sm text-gray-400">{tr("Пока нет кампаний", "No campaigns yet")}</div>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className={`rounded-xl border p-3 ${activeId === c.id ? "border-[#E31E24]/40 bg-red-50/40" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-800">{c.subject || tr("(без темы)", "(no subject)")}</div>
                      <div className="text-xs text-gray-400">
                        {c.status === "draft" ? tr("Черновик", "Draft") : c.status === "sending" ? tr("Отправляется…", "Sending…") : tr("Отправлено", "Sent")}
                        {c.stats.total > 0 ? ` · ${c.stats.sent}/${c.stats.total}${c.stats.failed ? ` · ⚠ ${c.stats.failed}` : ""}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => void test(c.id)}>
                        <FlaskConical className="mr-1 h-3.5 w-3.5" /> {tr("Тест", "Test")}
                      </Button>
                      {c.status === "draft" ? (
                        <Button size="sm" className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={() => void send(c.id)}>
                          <Send className="mr-1 h-3.5 w-3.5" /> {tr("Отправить", "Send")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
