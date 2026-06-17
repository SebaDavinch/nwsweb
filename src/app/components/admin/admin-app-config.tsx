import { useEffect, useState } from "react";
import { Save, RefreshCw, Plus, Trash2, Smartphone, Flag, Check, Smile, Upload, Download, Package } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useLanguage } from "../../context/language-context";

interface RadioStation {
  id: string;
  name: string;
  url: string;
  kind?: string;
  region?: string;
}

interface AppConfig {
  features: Record<string, boolean>;
  links: { site: string; discord: string };
  discordAppId: string;
  screenshotPinTtlMinutes: number;
  defaultTheme: "light" | "dark";
  defaultLanguage: "ru" | "en";
  radioStations: RadioStation[];
  announcement: { enabled: boolean; text: string; level: "info" | "warning" };
  minVersion: string;
  chatModerators: string[];
  updatedAt: string | null;
}

interface ChatReport {
  id: string;
  room: string;
  messageId: string;
  reason: string;
  text: string;
  targetName: string | null;
  reporterName: string | null;
  ts: string;
  resolved: boolean;
}

const FEATURE_LABELS: Record<string, [string, string]> = {
  chat: ["Чат", "Chat"],
  map: ["Карта", "Map"],
  radio: ["Радио", "Radio"],
  screenshots: ["Скриншоты", "Screenshots"],
  notifications: ["Уведомления", "Notifications"],
  discordPresence: ["Discord Rich Presence", "Discord Rich Presence"],
};

export function AdminAppConfig() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [modInput, setModInput] = useState("");
  const [reports, setReports] = useState<ChatReport[]>([]);

  const loadReports = async () => {
    try {
      const res = await fetch("/api/admin/chat-reports", { credentials: "include" });
      if (res.ok) {
        const p = await res.json();
        setReports(Array.isArray(p?.reports) ? p.reports : []);
      }
    } catch {
      /* ignore */
    }
  };

  const resolveReport = async (id: string, deleteMessage: boolean) => {
    try {
      await fetch(`/api/admin/chat-reports/${encodeURIComponent(id)}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteMessage }),
      });
      await loadReports();
    } catch {
      toast.error(tr("Ошибка", "Error"));
    }
  };

  const load = async () => {
    try {
      const res = await fetch("/api/admin/app-config", { credentials: "include" });
      if (res.ok) setConfig(await res.json());
    } catch {
      toast.error(tr("Не удалось загрузить конфиг", "Failed to load config"));
    }
  };

  useEffect(() => {
    void load();
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/app-config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setConfig(payload.config);
      toast.success(tr("Сохранено", "Saved"));
    } catch {
      toast.error(tr("Ошибка сохранения", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <div className="p-6 text-sm text-gray-500">{tr("Загрузка…", "Loading…")}</div>;
  }

  const patch = (p: Partial<AppConfig>) => setConfig({ ...config, ...p });
  const toggleFeature = (key: string) =>
    patch({ features: { ...config.features, [key]: !config.features[key] } });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Smartphone className="h-5 w-5 text-[#E31E24]" />
            {tr("Десктоп-приложение", "Desktop App")}
          </h1>
          <p className="text-sm text-gray-500">
            {tr("Управление функциями и настройками приложения пилота.", "Manage the pilot app features and settings.")}
            {config.updatedAt ? ` · ${new Date(config.updatedAt).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {tr("Обновить", "Reload")}
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-[#E31E24] hover:bg-[#c41a20]">
            <Save className="mr-2 h-4 w-4" />
            {saving ? tr("Сохранение…", "Saving…") : tr("Сохранить", "Save")}
          </Button>
        </div>
      </div>

      {/* Фичи */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{tr("Модули", "Features")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.keys(FEATURE_LABELS).map((key) => {
              const on = config.features[key];
              const [ru, en] = FEATURE_LABELS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFeature(key)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    on ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {tr(ru, en)}
                  <span className={`ml-2 h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-500" : "bg-gray-300"}`} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Общие настройки */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <Label>{tr("Ссылка на сайт", "Site link")}</Label>
            <Input value={config.links.site} onChange={(e) => patch({ links: { ...config.links, site: e.target.value } })} />
          </div>
          <div>
            <Label>Discord</Label>
            <Input value={config.links.discord} onChange={(e) => patch({ links: { ...config.links, discord: e.target.value } })} />
          </div>
          <div>
            <Label>Discord Application ID (Rich Presence)</Label>
            <Input value={config.discordAppId} onChange={(e) => patch({ discordAppId: e.target.value })} placeholder="123456789012345678" />
          </div>
          <div>
            <Label>{tr("Метки скриншотов живут (мин)", "Screenshot pin TTL (min)")}</Label>
            <Input
              type="number"
              value={config.screenshotPinTtlMinutes}
              onChange={(e) => patch({ screenshotPinTtlMinutes: Number(e.target.value) || 30 })}
            />
          </div>
          <div>
            <Label>{tr("Тема по умолчанию", "Default theme")}</Label>
            <select
              value={config.defaultTheme}
              onChange={(e) => patch({ defaultTheme: e.target.value as "light" | "dark" })}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="dark">{tr("Тёмная", "Dark")}</option>
              <option value="light">{tr("Светлая", "Light")}</option>
            </select>
          </div>
          <div>
            <Label>{tr("Язык по умолчанию", "Default language")}</Label>
            <select
              value={config.defaultLanguage}
              onChange={(e) => patch({ defaultLanguage: e.target.value as "ru" | "en" })}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Объявление */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{tr("Объявление в приложении", "In-app announcement")}</h2>
            <button
              type="button"
              onClick={() => patch({ announcement: { ...config.announcement, enabled: !config.announcement.enabled } })}
              className={`h-2.5 w-2.5 rounded-full ${config.announcement.enabled ? "bg-emerald-500" : "bg-gray-300"}`}
            />
          </div>
          <Input
            value={config.announcement.text}
            onChange={(e) => patch({ announcement: { ...config.announcement, text: e.target.value } })}
            placeholder={tr("Текст объявления для пилотов", "Announcement text for pilots")}
          />
        </CardContent>
      </Card>

      {/* Радиостанции */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{tr("Радиостанции", "Radio stations")}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patch({ radioStations: [...config.radioStations, { id: `st-${Date.now()}`, name: "", url: "", kind: "stream", region: "europe" }] })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              {tr("Добавить", "Add")}
            </Button>
          </div>
          <div className="space-y-2">
            {config.radioStations.map((s, i) => (
              <div key={s.id} className="flex gap-2">
                <Input
                  value={s.name}
                  placeholder={tr("Название", "Name")}
                  onChange={(e) => {
                    const next = [...config.radioStations];
                    next[i] = { ...s, name: e.target.value };
                    patch({ radioStations: next });
                  }}
                  className="w-1/3"
                />
                <Input
                  value={s.url}
                  placeholder="URL"
                  onChange={(e) => {
                    const next = [...config.radioStations];
                    next[i] = { ...s, url: e.target.value };
                    patch({ radioStations: next });
                  }}
                />
                <select
                  value={s.region || "europe"}
                  onChange={(e) => {
                    const next = [...config.radioStations];
                    next[i] = { ...s, region: e.target.value };
                    patch({ radioStations: next });
                  }}
                  className="rounded-md border border-gray-200 px-2 text-sm"
                >
                  <option value="europe">{tr("Европа", "Europe")}</option>
                  <option value="russia">{tr("Россия", "Russia")}</option>
                  <option value="cis">{tr("СНГ", "CIS")}</option>
                  <option value="atc">ATC</option>
                  <option value="other">{tr("Другое", "Other")}</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => patch({ radioStations: config.radioStations.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            {config.radioStations.length === 0 ? (
              <div className="text-sm text-gray-400">{tr("Станций пока нет", "No stations yet")}</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Модераторы чата */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{tr("Модераторы чата", "Chat moderators")}</h2>
          <p className="mb-3 text-xs text-gray-400">
            {tr("vAMSYS username или pilotId. Модераторы могут удалять сообщения.", "vAMSYS username or pilotId. Moderators can delete messages.")}
          </p>
          <div className="mb-3 flex gap-2">
            <Input
              value={modInput}
              onChange={(e) => setModInput(e.target.value)}
              placeholder={tr("username или ID", "username or ID")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && modInput.trim()) {
                  patch({ chatModerators: [...new Set([...config.chatModerators, modInput.trim()])] });
                  setModInput("");
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (modInput.trim()) {
                  patch({ chatModerators: [...new Set([...config.chatModerators, modInput.trim()])] });
                  setModInput("");
                }
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              {tr("Добавить", "Add")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.chatModerators.map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">
                {m}
                <button type="button" onClick={() => patch({ chatModerators: config.chatModerators.filter((x) => x !== m) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {config.chatModerators.length === 0 ? (
              <div className="text-sm text-gray-400">{tr("Модераторов пока нет", "No moderators yet")}</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Релизы приложения (билды для скачивания) */}
      <AppReleases tr={tr} language={language} />

      {/* Кастомные эмодзи */}
      <ChatEmojis tr={tr} />

      {/* Репорты чата */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              <Flag className="h-4 w-4 text-amber-500" />
              {tr("Репорты чата", "Chat reports")}
            </h2>
            <Button variant="outline" size="sm" onClick={() => void loadReports()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {tr("Обновить", "Reload")}
            </Button>
          </div>
          <div className="space-y-2">
            {reports.filter((r) => !r.resolved).length === 0 ? (
              <div className="text-sm text-gray-400">{tr("Активных репортов нет", "No active reports")}</div>
            ) : (
              reports
                .filter((r) => !r.resolved)
                .map((r) => (
                  <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800">
                          {r.targetName || "—"}{" "}
                          <span className="font-normal text-gray-400">
                            · {r.room === "general" ? tr("Общий", "General") : r.room}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {tr("Причина", "Reason")}: {r.reason} · {tr("от", "by")} {r.reporterName}
                        </div>
                        <div className="mt-1 rounded bg-white px-2 py-1 text-xs text-gray-700">{r.text || "—"}</div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => void resolveReport(r.id, true)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {tr("Удалить", "Delete")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void resolveReport(r.id, false)}>
                          <Check className="mr-1 h-3.5 w-3.5" />
                          {tr("Игнор", "Dismiss")}
                        </Button>
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

interface AppRelease {
  version: string;
  notes: string;
  platform: string;
  fileName?: string;
  size: number;
  uploadedAt: string | null;
  downloads: number;
}

function fmtBytes(b: number) {
  if (!b) return "—";
  const mb = b / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`;
}

function AppReleases({ tr, language }: { tr: (ru: string, en: string) => string; language: string }) {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = async () => {
    try {
      const r = await fetch("/api/admin/app-releases", { credentials: "include" });
      if (r.ok) {
        const p = await r.json();
        setReleases(Array.isArray(p?.releases) ? p.releases : []);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upload = () => {
    const v = version.trim().replace(/^v/i, "");
    if (!v) return toast.error(tr("Укажите версию", "Version required"));
    if (!file) return toast.error(tr("Выберите файл билда", "Choose a build file"));
    const ext = (file.name.split(".").pop() || "exe").toLowerCase();
    setBusy(true);
    setProgress(0);
    // XHR ради прогресса загрузки крупного файла.
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({ version: v, platform: "windows", ext });
    xhr.open("POST", `/api/admin/app-releases?${params.toString()}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    if (notes.trim()) xhr.setRequestHeader("X-Release-Notes", encodeURIComponent(notes.trim()));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success(tr("Релиз загружен", "Release uploaded"));
        setVersion("");
        setNotes("");
        setFile(null);
        void load();
      } else {
        toast.error(tr("Ошибка загрузки", "Upload failed"));
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      toast.error(tr("Ошибка сети", "Network error"));
    };
    xhr.send(file);
  };

  const remove = async (v: string) => {
    if (!window.confirm(tr(`Удалить версию ${v}?`, `Delete version ${v}?`))) return;
    try {
      const r = await fetch(`/api/admin/app-releases/${encodeURIComponent(v)}`, { method: "DELETE", credentials: "include" });
      if (r.ok) {
        toast.success(tr("Удалено", "Deleted"));
        void load();
      } else toast.error(tr("Ошибка", "Error"));
    } catch {
      toast.error(tr("Ошибка", "Error"));
    }
  };

  // Note header decoded server-side is URI-encoded; admin list shows raw stored notes.
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <Package className="h-4 w-4 text-[#E31E24]" />
          {tr("Релизы приложения (скачивание)", "App releases (downloads)")}
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          {tr(
            "Загрузите собранный билд (.exe из app:build). Появится на странице /download и будет доступен для скачивания.",
            "Upload the built installer (.exe from app:build). It appears on /download and becomes available for download."
          )}
        </p>

        <div className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr] sm:items-start">
          <div>
            <Label>{tr("Версия", "Version")}</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="0.1.0" />
          </div>
          <div>
            <Label>{tr("Изменения (changelog)", "Changes (changelog)")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={tr("Что нового в этой версии", "What's new in this version")}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {file ? file.name : tr("Выбрать файл (.exe)", "Choose file (.exe)")}
            <input
              type="file"
              accept=".exe,.msi,.zip"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {file ? <span className="text-xs text-gray-400">{fmtBytes(file.size)}</span> : null}
          <Button onClick={upload} disabled={busy} className="bg-[#E31E24] hover:bg-[#c41a20]">
            <Download className="mr-1 h-4 w-4" />
            {busy ? `${progress}%` : tr("Загрузить релиз", "Upload release")}
          </Button>
        </div>
        {busy ? (
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[#E31E24] transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : null}

        <div className="space-y-2">
          {releases.length === 0 ? (
            <div className="text-sm text-gray-400">{tr("Релизов пока нет", "No releases yet")}</div>
          ) : (
            releases.map((r) => (
              <div key={r.version} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    v{r.version}
                    <span className="text-xs font-normal text-gray-400">
                      {fmtBytes(r.size)} · {r.downloads || 0} {tr("загр.", "dl")}
                      {r.uploadedAt ? ` · ${new Date(r.uploadedAt).toLocaleDateString(language === "ru" ? "ru-RU" : "en-US")}` : ""}
                    </span>
                  </div>
                  {r.notes ? <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">{r.notes}</div> : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <a
                    href={`/api/app/download/${encodeURIComponent(r.version)}`}
                    className="inline-flex items-center rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                    title={tr("Скачать", "Download")}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void remove(r.version)}
                    className="rounded-md border border-gray-200 p-1.5 text-red-500 hover:bg-red-50"
                    title={tr("Удалить", "Delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomEmoji {
  name: string;
  url: string;
}

function ChatEmojis({ tr }: { tr: (ru: string, en: string) => string }) {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [name, setName] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/pilot/chat/emojis", { credentials: "include" });
      if (res.ok) {
        const p = await res.json();
        setEmojis(Array.isArray(p?.emojis) ? p.emojis : []);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 256 * 1024) {
      toast.error(tr("Файл больше 256 КБ", "File exceeds 256 KB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const add = async () => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!slug || !dataUrl) {
      toast.error(tr("Укажите имя и картинку", "Provide a name and image"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/chat/emojis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: slug, url: dataUrl }),
      });
      if (!res.ok) throw new Error();
      const p = await res.json();
      setEmojis(Array.isArray(p?.emojis) ? p.emojis : []);
      setName("");
      setDataUrl("");
      toast.success(tr("Добавлено", "Added"));
    } catch {
      toast.error(tr("Ошибка", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string) => {
    try {
      const res = await fetch(`/api/admin/chat/emojis/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const p = await res.json();
        setEmojis(Array.isArray(p?.emojis) ? p.emojis : []);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <Smile className="h-4 w-4 text-[#E31E24]" />
          {tr("Кастомные эмодзи чата", "Custom chat emoji")}
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          {tr(
            "Имя латиницей (a-z, 0-9, _). В чате вставляются как :имя:. Картинка ≤256 КБ.",
            "Latin name (a-z, 0-9, _). Used in chat as :name:. Image ≤256 KB."
          )}
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <Label>{tr("Имя", "Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="nordwind" />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {dataUrl ? tr("Заменить файл", "Replace file") : tr("Выбрать файл", "Choose file")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {dataUrl ? <img src={dataUrl} alt="" className="h-9 w-9 rounded object-contain" /> : null}
          <Button onClick={() => void add()} disabled={busy} className="bg-[#E31E24] hover:bg-[#c41a20]">
            <Plus className="mr-1 h-4 w-4" />
            {tr("Добавить", "Add")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {emojis.map((e) => (
            <span key={e.name} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm">
              <img src={e.url} alt={e.name} className="h-5 w-5 object-contain" />
              <span className="text-gray-600">:{e.name}:</span>
              <button type="button" onClick={() => void remove(e.name)} className="text-gray-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {emojis.length === 0 ? <div className="text-sm text-gray-400">{tr("Эмодзи пока нет", "No emoji yet")}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
