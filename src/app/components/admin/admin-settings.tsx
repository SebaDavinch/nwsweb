import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageUp, Palette, PaintBucket, RefreshCw, Save, Trash2, Upload, Joystick } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { emitSiteDesignUpdated, DEFAULT_SITE_DESIGN, type SiteDesignSettings } from "../../hooks/use-site-design";
import { useLanguage } from "../../context/language-context";

interface SystemStatus {
  vamsys?: {
    configured?: boolean;
    reachable?: boolean;
  };
  discord?: {
    configured?: boolean;
    newsChannelIdSet?: boolean;
  };
  server?: {
    port?: number;
  };
  ragProxy?: {
    url?: string;
    reachable?: boolean;
  };
}

interface AiStatus {
  configured?: boolean;
  lastError?: { reason: string; at: string } | null;
  knowledgeChars?: number;
  knowledgeBuiltAt?: number;
  cacheEntries?: number;
}

export function AdminSettings() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [status, setStatus] = useState<SystemStatus>({});
  const [aiStatus, setAiStatus] = useState<AiStatus>({});
  const [design, setDesign] = useState<SiteDesignSettings>(DEFAULT_SITE_DESIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  interface HubRelease { version: string; notes: string; uploadedAt: string | null; fileSizeBytes: number | null; downloads: number; }
  const [hubReleases, setHubReleases] = useState<HubRelease[]>([]);
  const [hubUploading, setHubUploading] = useState(false);
  const [hubDeleting, setHubDeleting] = useState<string | null>(null);
  const [hubVersion, setHubVersion] = useState("");
  const [hubNotes, setHubNotes] = useState("");
  const hubFileRef = useRef<HTMLInputElement>(null);

  interface LiveryCatalogEntry {
    id: string; name: string; aircraft: string; icao: string;
    description: string; previewUrl: string | null; packageName: string;
    version: string; fileSizeBytes: number | null; uploadedAt: string | null; downloads: number;
  }
  const [liveries, setLiveries] = useState<LiveryCatalogEntry[]>([]);
  const [liveryUploading, setLiveryUploading] = useState(false);
  const [liveryDeleting, setLiveryDeleting] = useState<string | null>(null);
  const [liveryId, setLiveryId] = useState("");
  const [liveryName, setLiveryName] = useState("");
  const [liveryAircraft, setLiveryAircraft] = useState("");
  const [liveryIcao, setLiveryIcao] = useState("");
  const [liveryDesc, setLiveryDesc] = useState("");
  const [liveryPreview, setLiveryPreview] = useState("");
  const [liveryPkg, setLiveryPkg] = useState("");
  const [liveryVersion, setLiveryVersion] = useState("1.0.0");
  const liveryFileRef = useRef<HTMLInputElement>(null);

  const loadDesign = async () => {
    try {
      const response = await fetch("/api/admin/site-design", { credentials: "include" });
      const payload = response.ok ? await response.json() : null;
      setDesign({
        ...DEFAULT_SITE_DESIGN,
        ...(payload?.design && typeof payload.design === "object" ? payload.design : {}),
      });
    } catch (error) {
      console.error("Failed to load site design", error);
    }
  };

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/admin/system-status");
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (active) {
          setStatus(payload || {});
        }
      } catch (error) {
        console.error("Failed to load system status", error);
      }
    };

    const loadAiStatus = async () => {
      try {
        const response = await fetch("/api/admin/ai/status", { credentials: "include" });
        if (response.ok && active) {
          setAiStatus(await response.json());
        }
      } catch { /* ignore */ }
    };

    const loadHubInfo = async () => {
      try {
        const r = await fetch("/api/admin/msfs-hub", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          setHubReleases(Array.isArray(data?.releases) ? data.releases : []);
        }
      } catch { /* ignore */ }
    };

    const loadLiveries = async () => {
      try {
        const r = await fetch("/api/admin/liveries", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          setLiveries(Array.isArray(data?.liveries) ? data.liveries : []);
        }
      } catch { /* ignore */ }
    };

    loadStatus();
    loadAiStatus().catch(() => undefined);
    loadDesign().catch(() => undefined);
    loadHubInfo().catch(() => undefined);
    loadLiveries().catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const healthBadge = (ok: boolean) => (
    <Badge
      variant="outline"
      className={ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}
    >
      {ok ? tr("ОК", "OK") : tr("Отсутствует", "Missing")}
    </Badge>
  );

  const previewLogo = useMemo(
    () => design.headerLogoDataUrl || design.loginLogoDataUrl || design.adminLogoDataUrl || design.footerLogoDataUrl,
    [design.adminLogoDataUrl, design.footerLogoDataUrl, design.headerLogoDataUrl, design.loginLogoDataUrl]
  );

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, key: keyof Pick<SiteDesignSettings, "headerLogoDataUrl" | "footerLogoDataUrl" | "loginLogoDataUrl" | "adminLogoDataUrl">) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDesign((current) => ({
        ...current,
        [key]: typeof reader.result === "string" ? reader.result : current[key],
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveDesign = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/site-design", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || tr("Не удалось сохранить дизайн сайта", "Failed to save site design")));
      }

      const nextDesign = {
        ...DEFAULT_SITE_DESIGN,
        ...(payload?.design && typeof payload.design === "object" ? payload.design : design),
      };
      setDesign(nextDesign);
      emitSiteDesignUpdated(nextDesign);
      toast.success(tr("Дизайн сайта сохранен", "Site design saved"));
    } catch (error) {
      console.error("Failed to save site design", error);
      toast.error(String(error || tr("Не удалось сохранить дизайн сайта", "Failed to save site design")));
    } finally {
      setIsSaving(false);
    }
  };

  const refreshSettings = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetch("/api/admin/system-status").then((response) => (response.ok ? response.json() : null)).then((payload) => {
          if (payload) setStatus(payload || {});
        }),
        fetch("/api/admin/ai/status", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((payload) => {
          if (payload) setAiStatus(payload);
        }),
        loadDesign(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const reloadHubReleases = async () => {
    try {
      const r = await fetch("/api/admin/msfs-hub", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setHubReleases(Array.isArray(data?.releases) ? data.releases : []);
      }
    } catch { /* ignore */ }
  };

  const uploadHub = async () => {
    const file = hubFileRef.current?.files?.[0];
    if (!file) { toast.error(tr("Выберите ZIP-файл", "Select a ZIP file")); return; }
    if (!hubVersion.trim()) { toast.error(tr("Укажите версию (например 1.2.0)", "Enter version (e.g. 1.2.0)")); return; }
    setHubUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const params = new URLSearchParams({ version: hubVersion.trim() });
      const r = await fetch(`/api/admin/msfs-hub?${params}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/zip", "X-Release-Notes": hubNotes.trim() },
        body: buf,
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || tr("Ошибка загрузки", "Upload failed"));
      toast.success(tr(`Пакет v${data?.version} опубликован`, `Package v${data?.version} published`));
      setHubVersion("");
      setHubNotes("");
      if (hubFileRef.current) hubFileRef.current.value = "";
      await reloadHubReleases();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setHubUploading(false);
    }
  };

  const deleteHub = async (version: string) => {
    setHubDeleting(version);
    try {
      const r = await fetch(`/api/admin/msfs-hub/${encodeURIComponent(version)}`, { method: "DELETE", credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || tr("Ошибка удаления", "Delete failed"));
      toast.success(tr(`Версия v${version} удалена`, `Version v${version} deleted`));
      await reloadHubReleases();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setHubDeleting(null);
    }
  };

  const reloadLiveries = async () => {
    const r = await fetch("/api/admin/liveries", { credentials: "include" });
    if (r.ok) { const d = await r.json(); setLiveries(Array.isArray(d?.liveries) ? d.liveries : []); }
  };

  const uploadLivery = async () => {
    const id = liveryId.trim().replace(/[^a-zA-Z0-9-_]/g, "");
    if (!id) return toast.error(tr("Укажи ID ливреи", "Enter livery ID"));
    const file = liveryFileRef.current?.files?.[0];
    if (!file) return toast.error(tr("Выбери ZIP-файл", "Select a ZIP file"));
    setLiveryUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const params = new URLSearchParams({ id, name: liveryName || id, aircraft: liveryAircraft, icao: liveryIcao, packageName: liveryPkg || id, version: liveryVersion || "1.0.0" });
      const r = await fetch(`/api/admin/liveries?${params}`, {
        method: "POST",
        credentials: "include",
        body: buf,
        headers: { "x-description": liveryDesc, "x-preview-url": liveryPreview },
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || tr("Ошибка загрузки", "Upload failed"));
      toast.success(tr(`Ливрея «${liveryName || id}» загружена`, `Livery "${liveryName || id}" uploaded`));
      setLiveryId(""); setLiveryName(""); setLiveryAircraft(""); setLiveryIcao(""); setLiveryDesc(""); setLiveryPreview(""); setLiveryPkg(""); setLiveryVersion("1.0.0");
      if (liveryFileRef.current) liveryFileRef.current.value = "";
      await reloadLiveries();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setLiveryUploading(false);
    }
  };

  const deleteLivery = async (id: string) => {
    setLiveryDeleting(id);
    try {
      const r = await fetch(`/api/admin/liveries/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || tr("Ошибка удаления", "Delete failed"));
      toast.success(tr("Ливрея удалена", "Livery deleted"));
      await reloadLiveries();
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setLiveryDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tr("Системные настройки", "System Settings")}</h2>
          <p className="text-sm text-gray-500">{tr("Состояние окружения и управление брендингом сайта", "Environment health plus site branding controls")}</p>
        </div>
        <Button variant="outline" onClick={() => refreshSettings()} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {tr("Обновить", "Refresh")}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <Palette className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{tr("Дизайн сайта", "Site design")}</h3>
                <p className="text-sm text-gray-500">{tr("Управляйте логотипами и фирменными цветами для публичного сайта и админки.", "Manage the visible logos and brand colors for public and admin surfaces.")}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr("Название сайта", "Site title")}</Label>
                  <Input value={design.siteTitle} onChange={(event) => setDesign((current) => ({ ...current, siteTitle: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Подзаголовок", "Tagline")}</Label>
                  <Input value={design.tagline} onChange={(event) => setDesign((current) => ({ ...current, tagline: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{tr("Ссылка на VK-сообщество", "VK community URL")}</Label>
                  <Input
                    placeholder="https://vk.com/..."
                    value={design.vkCommunityUrl}
                    onChange={(event) => setDesign((current) => ({ ...current, vkCommunityUrl: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Название VK-блока", "VK card title")}</Label>
                  <Input
                    placeholder={tr("Nordwind Virtual VK", "Nordwind Virtual VK")}
                    value={design.vkCommunityName}
                    onChange={(event) => setDesign((current) => ({ ...current, vkCommunityName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr("VK widget URL", "VK widget URL")}</Label>
                  <Input
                    placeholder="https://vk.com/widget_community.php?..."
                    value={design.vkWidgetUrl}
                    onChange={(event) => setDesign((current) => ({ ...current, vkWidgetUrl: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Основной цвет", "Primary color")}</Label>
                  <Input type="color" value={design.primaryColor} onChange={(event) => setDesign((current) => ({ ...current, primaryColor: event.target.value }))} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Акцентный цвет", "Accent color")}</Label>
                  <Input type="color" value={design.accentColor} onChange={(event) => setDesign((current) => ({ ...current, accentColor: event.target.value }))} className="h-11" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ["headerLogoDataUrl", tr("Логотип шапки", "Header logo")],
                  ["footerLogoDataUrl", tr("Логотип подвала", "Footer logo")],
                  ["loginLogoDataUrl", tr("Логотип входа", "Login logo")],
                  ["adminLogoDataUrl", tr("Логотип админки", "Admin logo")],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2 rounded-xl border border-gray-200 p-4">
                    <Label>{label}</Label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50">
                      <ImageUp className="h-4 w-4" />
                      {tr("Загрузить изображение", "Upload image")}
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFileUpload(event, key)} />
                    </label>
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      {design[key] ? <img src={design[key]} alt={label} className="mx-auto max-h-16 w-auto object-contain" /> : <span className="text-xs text-gray-400">{tr("Используется ассет по умолчанию", "Using default asset")}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={saveDesign} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {tr("Сохранить дизайн", "Save design")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-gray-900">{tr("Предпросмотр", "Preview")}</h3>
                <p className="text-sm text-gray-500">{tr("Быстрый предпросмотр логотипов и основной цветовой палитры.", "Quick brand preview for logos and main palette.")}</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between px-5 py-4 text-white" style={{ backgroundColor: design.accentColor }}>
                  <div className="flex items-center gap-3">
                    {previewLogo ? <img src={previewLogo} alt={design.siteTitle} className="h-10 w-auto object-contain" /> : null}
                    <div>
                      <div className="font-semibold">{design.siteTitle}</div>
                      <div className="text-xs text-white/70">{design.tagline || "—"}</div>
                    </div>
                  </div>
                  <div className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: design.primaryColor }}>Brand</div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="h-2 rounded-full" style={{ backgroundColor: design.primaryColor }} />
                  <div className="flex gap-3">
                    <div className="rounded-lg px-4 py-2 text-white" style={{ backgroundColor: design.primaryColor }}>{tr("Основной", "Primary")}</div>
                    <div className="rounded-lg border px-4 py-2" style={{ borderColor: design.primaryColor, color: design.primaryColor }}>{tr("Контур", "Outline")}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">{tr("Учетные данные vAMSYS настроены", "vAMSYS credentials configured")}</span>
                  {healthBadge(Boolean(status.vamsys?.configured))}
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">{tr("vAMSYS доступен", "vAMSYS reachable")}</span>
                  {healthBadge(Boolean(status.vamsys?.reachable))}
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">{tr("Публикация в Discord настроена", "Discord publish configured")}</span>
                  {healthBadge(Boolean(status.discord?.configured))}
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">{tr("RAGTest / nwshub proxy", "RAGTest / nwshub proxy")}</span>
                  {healthBadge(Boolean(status.ragProxy?.reachable))}
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">{tr("Порт сервера", "Server port")}</span>
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                    {status.server?.port || 8787}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">{tr("AI-помощник (ключ API)", "AI assistant (API key)")}</span>
                  {healthBadge(Boolean(aiStatus.configured))}
                </div>
                {aiStatus.lastError ? (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 break-all">
                    <span className="font-semibold">{tr("Последняя ошибка AI: ", "Last AI error: ")}</span>
                    {aiStatus.lastError.reason}
                    {aiStatus.lastError.at ? <span className="ml-1 text-red-400">({new Date(aiStatus.lastError.at).toLocaleString()})</span> : null}
                  </div>
                ) : aiStatus.configured ? (
                  <div className="text-xs text-gray-400">
                    {tr("AI работает штатно", "AI operating normally")}
                    {aiStatus.knowledgeChars ? tr(` · база знаний ${Math.round(aiStatus.knowledgeChars / 1024)} кб`, ` · knowledge ${Math.round(aiStatus.knowledgeChars / 1024)} kb`) : ""}
                    {aiStatus.cacheEntries ? tr(` · кэш ${aiStatus.cacheEntries} отв.`, ` · cache ${aiStatus.cacheEntries} entries`) : ""}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── MSFS Hub release management ── */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <Joystick className="h-5 w-5 text-sky-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{tr("vNWS Hub — MSFS-панель", "vNWS Hub — MSFS Panel")}</h3>
              <p className="text-sm text-gray-500">{tr("Публикация ZIP-пакета. Пилоты увидят уведомление об обновлении в панели при следующем запуске.", "Publish a ZIP package. Pilots will see an update prompt in the panel on next launch.")}</p>
            </div>
          </div>

          {/* Upload form */}
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] mb-4">
            <div className="space-y-1.5">
              <Label>{tr("Версия", "Version")}</Label>
              <Input placeholder="1.2.0" value={hubVersion} onChange={(e) => setHubVersion(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Заметки к версии (опц.)", "Release notes (optional)")}</Label>
              <Input
                placeholder={tr("Что изменилось...", "What changed...")}
                value={hubNotes}
                onChange={(e) => setHubNotes(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end">
              <Button variant="outline" onClick={() => hubFileRef.current?.click()} className="gap-2 border-dashed">
                <Upload className="h-4 w-4" />
                {tr("Выбрать ZIP", "Select ZIP")}
              </Button>
              <input ref={hubFileRef} type="file" accept=".zip" className="hidden" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <Button onClick={uploadHub} disabled={hubUploading} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white">
              {hubUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {hubUploading ? tr("Загрузка...", "Uploading...") : tr("Опубликовать пакет", "Publish package")}
            </Button>
          </div>

          {/* Release history */}
          {hubReleases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
              {tr("Ни одного пакета не опубликовано", "No packages published yet")}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                {tr("История версий", "Release history")}
              </div>
              {hubReleases.map((r, i) => (
                <div
                  key={r.version}
                  className={`rounded-xl border p-4 ${i === 0 ? "border-sky-200 bg-sky-50/60" : "border-gray-100 bg-white"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-800">v{r.version}</span>
                      {i === 0 && (
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {tr("Актуальная", "Latest")}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {r.uploadedAt ? new Date(r.uploadedAt).toLocaleString(language === "ru" ? "ru-RU" : "en-US") : ""}
                        {r.fileSizeBytes ? ` · ${(r.fileSizeBytes / (1024 * 1024)).toFixed(1)} МБ` : ""}
                        {r.downloads ? ` · ${r.downloads} ${tr("скач.", "dl.")}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/app/msfs-hub/download/${r.version}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-sky-400 hover:text-sky-600 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {tr("Скачать", "Download")}
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={hubDeleting === r.version}
                        onClick={() => deleteHub(r.version)}
                        className="h-8 px-2.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {hubDeleting === r.version ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : tr("Удалить", "Delete")}
                      </Button>
                    </div>
                  </div>
                  {r.notes ? (
                    <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{r.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Livery management ── */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <PaintBucket className="h-5 w-5 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{tr("Ливреи", "Liveries")}</h3>
              <p className="text-sm text-gray-500">{tr("Загружай ZIP-пакеты ливрей. Пилоты устанавливают их в один клик через NordwindHub.", "Upload livery ZIP packages. Pilots install them in one click via NordwindHub.")}</p>
            </div>
          </div>

          {/* Upload form */}
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <div className="space-y-1.5">
              <Label>{tr("ID (kebab-case)", "ID (kebab-case)")}</Label>
              <Input placeholder="nws-b738-v1" value={liveryId} onChange={(e) => { setLiveryId(e.target.value); if (!liveryPkg) setLiveryPkg(e.target.value); }} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Название", "Name")}</Label>
              <Input placeholder="Boeing 737-800 Nordwind" value={liveryName} onChange={(e) => setLiveryName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Тип ВС", "Aircraft type")}</Label>
              <Input placeholder="PMDG 737-800" value={liveryAircraft} onChange={(e) => setLiveryAircraft(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("ИКАО", "ICAO")}</Label>
              <Input placeholder="NWS" value={liveryIcao} onChange={(e) => setLiveryIcao(e.target.value.toUpperCase())} maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Имя пакета (Community folder)", "Package name (Community folder)")}</Label>
              <Input placeholder="nws-livery-b738" value={liveryPkg} onChange={(e) => setLiveryPkg(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Версия", "Version")}</Label>
              <Input placeholder="1.0.0" value={liveryVersion} onChange={(e) => setLiveryVersion(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{tr("Описание", "Description")}</Label>
              <Input placeholder={tr("Краткое описание ливреи...", "Short description...")} value={liveryDesc} onChange={(e) => setLiveryDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{tr("URL превью-изображения", "Preview image URL")}</Label>
              <Input placeholder="https://..." value={liveryPreview} onChange={(e) => setLiveryPreview(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Button variant="outline" onClick={() => liveryFileRef.current?.click()} className="gap-2 border-dashed">
              <Upload className="h-4 w-4" />
              {liveryFileRef.current?.files?.[0]?.name || tr("Выбрать ZIP", "Select ZIP")}
            </Button>
            <input ref={liveryFileRef} type="file" accept=".zip" className="hidden" />
            <Button onClick={uploadLivery} disabled={liveryUploading} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
              {liveryUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {liveryUploading ? tr("Загрузка...", "Uploading...") : tr("Загрузить ливрею", "Upload livery")}
            </Button>
          </div>

          {/* Catalog */}
          {liveries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
              {tr("Ливрей ещё нет", "No liveries yet")}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                {tr("Каталог", "Catalog")} ({liveries.length})
              </div>
              {liveries.map((l) => (
                <div key={l.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4">
                  {l.previewUrl && (
                    <img src={l.previewUrl} alt={l.name} className="h-16 w-24 shrink-0 rounded-lg object-cover bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800">{l.name}</span>
                      {l.icao && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{l.icao}</span>}
                      <span className="text-xs text-gray-400">v{l.version}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[l.aircraft, l.packageName, l.fileSizeBytes ? `${(l.fileSizeBytes / (1024 * 1024)).toFixed(1)} МБ` : null, l.downloads ? `${l.downloads} ${tr("скач.", "dl.")}` : null].filter(Boolean).join(" · ")}
                    </p>
                    {l.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{l.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/api/app/liveries/${l.id}/download`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-400 hover:text-red-600 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {tr("Скачать", "Download")}
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={liveryDeleting === l.id}
                      onClick={() => deleteLivery(l.id)}
                      className="h-8 px-2.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      {liveryDeleting === l.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
