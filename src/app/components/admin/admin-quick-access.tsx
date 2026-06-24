import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../../context/language-context";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Bell,
  Building2,
  ClipboardList,
  ExternalLink,
  FileText,
  Grip,
  Link2,
  LucideIcon,
  Pin,
  Plus,
  Route,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export type QuickLinkPresetId =
  | "routes"
  | "routesTurbo"
  | "routesSoonStarting"
  | "bookings"
  | "staff"
  | "staffSync"
  | "documents"
  | "settings"
  | "news"
  | "airports"
  | "hubs"
  | "vamsys";

type AdminQuickAccessItem =
  | {
      id: string;
      type: "preset";
      presetId: QuickLinkPresetId;
    }
  | {
      id: string;
      type: "custom";
      label: string;
      url: string;
      description?: string;
    };

interface QuickLinkPreset {
  id: QuickLinkPresetId;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  icon: LucideIcon;
  colorClass: string;
  path?: string;
  href?: string;
}

interface ResolvedQuickAccessItem {
  id: string;
  type: "preset" | "custom";
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  url: string;
  isExternal: boolean;
  icon: LucideIcon;
  colorClass: string;
  presetId?: QuickLinkPresetId;
}

interface AdminQuickAccessConfig {
  items: AdminQuickAccessItem[];
}

// ── UTC clock + AIRAC ──────────────────────────────────────────────────────
const AIRAC_EPOCH_MS = Date.UTC(2024, 0, 18);
const AIRAC_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;

function getAiracInfo(now = new Date()) {
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.floor((todayMs - AIRAC_EPOCH_MS) / AIRAC_CYCLE_MS);
  const startMs = AIRAC_EPOCH_MS + n * AIRAC_CYCLE_MS;
  const start = new Date(startMs);
  const end = new Date(startMs + AIRAC_CYCLE_MS - 86400000);
  const yr = start.getUTCFullYear();
  const n0 = Math.ceil((Date.UTC(yr, 0, 1) - AIRAC_EPOCH_MS) / AIRAC_CYCLE_MS);
  const ident = `${String(yr).slice(-2)}${String(n - n0 + 1).padStart(2, "0")}`;
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  return { ident, label: `${fmt(start)} – ${fmt(end)}` };
}

function utcHHMM() {
  const d = new Date();
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// ── Storage keys ───────────────────────────────────────────────────────────
const ADMIN_QUICK_ACCESS_STORAGE_KEY = "admin_dashboard_quick_access_v2";
const ADMIN_QUICK_ACCESS_LEGACY_STORAGE_KEY = "admin_dashboard_quick_access_v1";
const ADMIN_QUICK_ACCESS_EVENT = "admin-quick-access-updated";
const ADMIN_QUICK_ACCESS_COMPACT_KEY = "admin_dashboard_quick_access_compact_v1";

const ADMIN_QUICK_LINK_PRESETS: QuickLinkPreset[] = [
  {
    id: "routes",
    label: "Маршруты",
    labelEn: "Routes",
    description: "Открыть редактор маршрутов и инструменты курирования.",
    descriptionEn: "Open the route editor and curation tools.",
    icon: Route,
    colorClass: "bg-red-50 text-red-700",
    path: "/admin/routes",
  },
  {
    id: "routesTurbo",
    label: "Маршруты Turbo",
    labelEn: "Routes Turbo",
    description: "Открыть управление маршрутами с turbo-режимом редактора.",
    descriptionEn: "Open route management with turbo editor mode.",
    icon: Route,
    colorClass: "bg-rose-50 text-rose-700",
    path: "/admin/routes?mode=turbo",
  },
  {
    id: "routesSoonStarting",
    label: "Скоро стартуют",
    labelEn: "Starting Soon",
    description: "Перейти к маршрутам с фильтром по ближайшим вылетам.",
    descriptionEn: "Go to routes filtered by upcoming departures.",
    icon: Route,
    colorClass: "bg-pink-50 text-pink-700",
    path: "/admin/routes?mode=turbo&section=soon-starting",
  },
  {
    id: "bookings",
    label: "Букинги",
    labelEn: "Bookings",
    description: "Проверить и скорректировать метаданные букингов.",
    descriptionEn: "Review and adjust booking metadata.",
    icon: ClipboardList,
    colorClass: "bg-orange-50 text-orange-700",
    path: "/admin/bookings",
  },
  {
    id: "staff",
    label: "Команда VA",
    labelEn: "VA Staff",
    description: "Управление синхронизированным составом и рангами.",
    descriptionEn: "Manage synced staff roster and ranks.",
    icon: ShieldCheck,
    colorClass: "bg-emerald-50 text-emerald-700",
    path: "/admin/staff",
  },
  {
    id: "staffSync",
    label: "Синхронизация staff",
    labelEn: "Staff Sync",
    description: "Открыть раздел команды и сразу запустить синхронизацию.",
    descriptionEn: "Open staff section and trigger sync immediately.",
    icon: ShieldCheck,
    colorClass: "bg-lime-50 text-lime-700",
    path: "/admin/staff?sync=1",
  },
  {
    id: "documents",
    label: "Документы",
    labelEn: "Documents",
    description: "Быстрый переход к редактированию документов.",
    descriptionEn: "Quick access to document editing.",
    icon: FileText,
    colorClass: "bg-sky-50 text-sky-700",
    path: "/admin/documents",
  },
  {
    id: "settings",
    label: "Настройки",
    labelEn: "Settings",
    description: "Брендинг, интеграции и глобальные переключатели.",
    descriptionEn: "Branding, integrations and global toggles.",
    icon: Settings2,
    colorClass: "bg-violet-50 text-violet-700",
    path: "/admin/settings",
  },
  {
    id: "news",
    label: "Новости",
    labelEn: "News",
    description: "Обновление новостей админки и публичных объявлений.",
    descriptionEn: "Update admin news and public announcements.",
    icon: Bell,
    colorClass: "bg-amber-50 text-amber-700",
    path: "/admin/news",
  },
  {
    id: "airports",
    label: "Аэропорты",
    labelEn: "Airports",
    description: "Редактирование аэропортов, оверлеев и справочников.",
    descriptionEn: "Edit airports, overlays and reference data.",
    icon: Building2,
    colorClass: "bg-cyan-50 text-cyan-700",
    path: "/admin/airports",
  },
  {
    id: "hubs",
    label: "Хабы",
    labelEn: "Hubs",
    description: "Управление хабами, их позициями и подписями.",
    descriptionEn: "Manage hubs, their positions and labels.",
    icon: Building2,
    colorClass: "bg-teal-50 text-teal-700",
    path: "/admin/hubs",
  },
  {
    id: "vamsys",
    label: "vAMSYS Ops",
    labelEn: "vAMSYS Ops",
    description: "Открыть внешний backoffice в новой вкладке.",
    descriptionEn: "Open external backoffice in a new tab.",
    icon: ExternalLink,
    colorClass: "bg-slate-100 text-slate-700",
    href: "https://vamsys.io",
  },
];

const DEFAULT_PINNED_PRESET_IDS: QuickLinkPresetId[] = ["routesTurbo", "routesSoonStarting", "staffSync", "documents", "settings", "vamsys"];

const createPresetItem = (presetId: QuickLinkPresetId): AdminQuickAccessItem => ({
  id: `preset:${presetId}`,
  type: "preset",
  presetId,
});

const createDefaultQuickAccessConfig = (): AdminQuickAccessConfig => ({
  items: DEFAULT_PINNED_PRESET_IDS.map((presetId) => createPresetItem(presetId)),
});

const normalizeQuickLinkUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed.replace(/^\/+/, "")}`;
};

const isExternalQuickLink = (value: string) => /^https?:\/\//i.test(String(value || "").trim());

const parseLegacyQuickAccessConfig = (raw: string | null): AdminQuickAccessConfig | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      pinnedPresetIds?: unknown[];
      customLinks?: Array<{ id?: unknown; label?: unknown; url?: unknown; description?: unknown }>;
    } | null;

    const presetIds = Array.isArray(parsed?.pinnedPresetIds)
      ? parsed.pinnedPresetIds.filter(
          (item): item is QuickLinkPresetId =>
            typeof item === "string" && ADMIN_QUICK_LINK_PRESETS.some((preset) => preset.id === item)
        )
      : [];

    const customItems = Array.isArray(parsed?.customLinks)
      ? parsed.customLinks
          .map((item) => ({
            id: String(item?.id || "").trim() || `custom:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "custom" as const,
            label: String(item?.label || "").trim(),
            url: normalizeQuickLinkUrl(String(item?.url || "")),
            description: String(item?.description || "").trim(),
          }))
          .filter((item) => item.label && item.url)
      : [];

    return {
      items: [...(presetIds.length > 0 ? presetIds : DEFAULT_PINNED_PRESET_IDS).map((presetId) => createPresetItem(presetId)), ...customItems],
    };
  } catch {
    return null;
  }
};

const parseStoredQuickAccessConfig = (raw: string | null): AdminQuickAccessConfig => {
  if (!raw) {
    return createDefaultQuickAccessConfig();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminQuickAccessConfig> | null;
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            if (item.type === "preset") {
              const presetId = String((item as { presetId?: unknown }).presetId || "") as QuickLinkPresetId;
              if (!ADMIN_QUICK_LINK_PRESETS.some((preset) => preset.id === presetId)) {
                return null;
              }
              return createPresetItem(presetId);
            }

            if (item.type === "custom") {
              const customItem = item as { id?: unknown; label?: unknown; url?: unknown; description?: unknown };
              const label = String(customItem.label || "").trim();
              const url = normalizeQuickLinkUrl(String(customItem.url || ""));
              if (!label || !url) {
                return null;
              }
              return {
                id: String(customItem.id || "").trim() || `custom:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: "custom" as const,
                label,
                url,
                description: String(customItem.description || "").trim(),
              };
            }

            return null;
          })
          .filter((item): item is AdminQuickAccessItem => Boolean(item))
      : [];

    return {
      items: items.length > 0 ? items : createDefaultQuickAccessConfig().items,
    };
  } catch {
    return createDefaultQuickAccessConfig();
  }
};

const resolveQuickAccessItem = (item: AdminQuickAccessItem): ResolvedQuickAccessItem | null => {
  if (item.type === "preset") {
    const preset = ADMIN_QUICK_LINK_PRESETS.find((entry) => entry.id === item.presetId);
    if (!preset) {
      return null;
    }

    const url = preset.path || preset.href || "";
    return {
      id: item.id,
      type: "preset",
      label: preset.label,
      labelEn: preset.labelEn,
      description: preset.description,
      descriptionEn: preset.descriptionEn,
      url,
      isExternal: Boolean(preset.href),
      icon: preset.icon,
      colorClass: preset.colorClass,
      presetId: preset.id,
    };
  }

  return {
    id: item.id,
    type: "custom",
    label: item.label,
    labelEn: item.label,
    description: item.description || item.url,
    descriptionEn: item.description || item.url,
    url: item.url,
    isExternal: isExternalQuickLink(item.url),
    icon: Link2,
    colorClass: "bg-gray-100 text-gray-700",
  };
};

function useAdminQuickAccess() {
  const [config, setConfig] = useState<AdminQuickAccessConfig>(createDefaultQuickAccessConfig());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(ADMIN_QUICK_ACCESS_STORAGE_KEY);
    if (stored) {
      setConfig(parseStoredQuickAccessConfig(stored));
      return;
    }

    const legacy = parseLegacyQuickAccessConfig(window.localStorage.getItem(ADMIN_QUICK_ACCESS_LEGACY_STORAGE_KEY));
    if (legacy) {
      setConfig(legacy);
      window.localStorage.setItem(ADMIN_QUICK_ACCESS_STORAGE_KEY, JSON.stringify(legacy));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_QUICK_ACCESS_STORAGE_KEY) {
        setConfig(parseStoredQuickAccessConfig(event.newValue));
      }
    };

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<AdminQuickAccessConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(ADMIN_QUICK_ACCESS_EVENT, handleCustomUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ADMIN_QUICK_ACCESS_EVENT, handleCustomUpdate as EventListener);
    };
  }, []);

  const persistConfig = (nextConfig: AdminQuickAccessConfig) => {
    setConfig(nextConfig);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_QUICK_ACCESS_STORAGE_KEY, JSON.stringify(nextConfig));
      window.dispatchEvent(new CustomEvent(ADMIN_QUICK_ACCESS_EVENT, { detail: nextConfig }));
    }
  };

  const resolvedItems = useMemo(
    () => config.items.map((item) => resolveQuickAccessItem(item)).filter((item): item is ResolvedQuickAccessItem => Boolean(item)),
    [config.items]
  );

  const availablePresets = useMemo(() => {
    const pinnedPresetIds = new Set(
      config.items
        .filter((item): item is Extract<AdminQuickAccessItem, { type: "preset" }> => item.type === "preset")
        .map((item) => item.presetId)
    );

    return ADMIN_QUICK_LINK_PRESETS.filter((preset) => !pinnedPresetIds.has(preset.id));
  }, [config.items]);

  const isPresetPinned = (presetId: QuickLinkPresetId) =>
    config.items.some((item) => item.type === "preset" && item.presetId === presetId);

  const togglePreset = (presetId: QuickLinkPresetId) => {
    if (isPresetPinned(presetId)) {
      persistConfig({
        items: config.items.filter((item) => !(item.type === "preset" && item.presetId === presetId)),
      });
      return;
    }

    persistConfig({
      items: [...config.items, createPresetItem(presetId)],
    });
  };

  const addCustomLink = ({ label, url, description }: { label: string; url: string; description?: string }) => {
    const normalizedUrl = normalizeQuickLinkUrl(url);
    if (!label.trim() || !normalizedUrl) {
      return false;
    }

    persistConfig({
      items: [
        ...config.items,
        {
          id: `custom:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "custom",
          label: label.trim(),
          url: normalizedUrl,
          description: String(description || "").trim(),
        },
      ],
    });
    return true;
  };

  const removeItem = (itemId: string) => {
    persistConfig({
      items: config.items.filter((item) => item.id !== itemId),
    });
  };

  const moveItem = (itemId: string, direction: "up" | "down" | "left" | "right") => {
    const index = config.items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }

    const movesBackward = direction === "up" || direction === "left";
    const targetIndex = movesBackward ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.items.length) {
      return;
    }

    const nextItems = [...config.items];
    const [movedItem] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, movedItem);
    persistConfig({ items: nextItems });
  };

  const reset = () => {
    persistConfig(createDefaultQuickAccessConfig());
  };

  return {
    resolvedItems,
    availablePresets,
    isPresetPinned,
    togglePreset,
    addCustomLink,
    removeItem,
    moveItem,
    reset,
  };
}

function QuickAccessLinkWrapper({
  item,
  className,
  title,
  children,
}: {
  item: ResolvedQuickAccessItem;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  if (item.isExternal) {
    return (
      <a href={item.url} target="_blank" rel="noreferrer" className={className} title={title}>
        {children}
      </a>
    );
  }

  return (
    <Link to={item.url} className={className} title={title}>
      {children}
    </Link>
  );
}

function QuickAccessManageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const quickAccess = useAdminQuickAccess();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [customLinkLabel, setCustomLinkLabel] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [customLinkDescription, setCustomLinkDescription] = useState("");

  const handleAddCustomLink = () => {
    const didAdd = quickAccess.addCustomLink({
      label: customLinkLabel,
      url: customLinkUrl,
      description: customLinkDescription,
    });

    if (!didAdd) {
      toast.error(tr("Укажите название и URL ссылки", "Set both label and URL for the quick link"));
      return;
    }

    setCustomLinkLabel("");
    setCustomLinkUrl("");
    setCustomLinkDescription("");
  };

  const handleReset = () => {
    quickAccess.reset();
    setCustomLinkLabel("");
    setCustomLinkUrl("");
    setCustomLinkDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{tr("Настроить быстрый доступ", "Customize Quick Access")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{tr("Текущий порядок", "Current order")}</h3>
              <p className="mt-1 text-sm text-gray-500">{tr("Меняйте порядок активных ссылок и убирайте лишнее.", "Reorder active links and remove unwanted ones.")}</p>
            </div>
            <div className="space-y-3">
              {quickAccess.resolvedItems.length > 0 ? (
                quickAccess.resolvedItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="rounded-xl bg-gray-100 p-2 text-gray-500">
                        <Grip className="h-4 w-4" />
                      </div>
                      <div className={`rounded-xl p-2 ${item.colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{language === "ru" ? item.label : item.labelEn}</div>
                        <div className="truncate text-sm text-gray-500">{language === "ru" ? item.description : item.descriptionEn}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => quickAccess.moveItem(item.id, "up")} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => quickAccess.moveItem(item.id, "down")} disabled={index === quickAccess.resolvedItems.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => quickAccess.removeItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  {tr("Быстрый доступ пуст. Закрепите пресет или добавьте собственную ссылку.", "Quick access is empty. Pin a preset or add a custom link.")}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">{tr("Встроенные разделы", "Built-in sections")}</h3>
              <p className="mt-1 text-sm text-gray-500">{tr("Закрепляйте или снимайте стандартные admin-разделы.", "Pin or unpin standard admin sections.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ADMIN_QUICK_LINK_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const active = quickAccess.isPresetPinned(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => quickAccess.togglePreset(preset.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${active ? "border-red-200 bg-red-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`rounded-xl p-2 ${preset.colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${active ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {active ? tr("Закреплено", "Pinned") : tr("Доступно", "Available")}
                      </span>
                    </div>
                    <div className="mt-4 font-semibold text-gray-900">{language === "ru" ? preset.label : preset.labelEn}</div>
                    <div className="mt-1 text-sm text-gray-500">{language === "ru" ? preset.description : preset.descriptionEn}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{tr("Свои ссылки", "Custom links")}</h3>
              <p className="mt-1 text-sm text-gray-500">{tr("Добавьте внутренние admin-пути или внешние инструменты.", "Add internal admin paths or external tools.")}</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-2">
                <Label htmlFor="admin-quick-link-label">{tr("Название", "Label")}</Label>
                <Input id="admin-quick-link-label" value={customLinkLabel} onChange={(event) => setCustomLinkLabel(event.target.value)} placeholder="Dispatch board" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-quick-link-url">{tr("URL или путь", "URL or path")}</Label>
                <Input id="admin-quick-link-url" value={customLinkUrl} onChange={(event) => setCustomLinkUrl(event.target.value)} placeholder="/admin/routes or https://vamsys.io" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-quick-link-description">{tr("Описание", "Description")}</Label>
                <Input id="admin-quick-link-description" value={customLinkDescription} onChange={(event) => setCustomLinkDescription(event.target.value)} placeholder={tr("Необязательная подсказка", "Optional hint")} />
              </div>
              <Button className="w-full" onClick={handleAddCustomLink}>
                <Plus className="mr-2 h-4 w-4" />
                {tr("Добавить ссылку", "Add link")}
              </Button>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-500">
              {tr("Не закреплены", "Unpinned")}: {quickAccess.availablePresets.length > 0 ? quickAccess.availablePresets.map((item) => (language === "ru" ? item.label : item.labelEn)).join(", ") : tr("все закреплены", "all pinned")}.
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={handleReset}>{tr("Сбросить по умолчанию", "Reset to default")}</Button>
          <Button onClick={() => onOpenChange(false)}>{tr("Готово", "Done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminQuickAccessPanel() {
  const quickAccess = useAdminQuickAccess();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [utcTime, setUtcTime] = useState(utcHHMM);
  const airac = useMemo(() => getAiracInfo(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCompactMode(window.localStorage.getItem(ADMIN_QUICK_ACCESS_COMPACT_KEY) === "1");
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setUtcTime(utcHHMM()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const handleToggleCompactMode = () => {
    setCompactMode((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ADMIN_QUICK_ACCESS_COMPACT_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  return (
    <>
      <Card className="shadow-sm">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{tr("Быстрый доступ", "Quick Access")}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              {quickAccess.resolvedItems.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* UTC + AIRAC — компактный чип */}
            <div className="flex items-center divide-x divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white text-[11px]">
              <div className="px-2.5 py-1.5 text-center">
                <div className="font-bold tabular-nums leading-none text-gray-800">{utcTime}</div>
                <div className="mt-0.5 font-medium uppercase tracking-widest leading-none text-gray-400">UTC</div>
              </div>
              <div className="px-2.5 py-1.5">
                <div className="font-semibold leading-none text-gray-700">AIRAC {airac.ident}</div>
                <div className="mt-0.5 leading-none text-gray-400">{airac.label}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleCompactMode}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Grip className="h-3.5 w-3.5" />
              {compactMode ? tr("Подписи", "Labels") : tr("Иконки", "Icons")}
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Pin className="h-3.5 w-3.5" />
              {tr("Настроить", "Customize")}
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          {quickAccess.resolvedItems.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
              {quickAccess.resolvedItems.map((item) => {
                const Icon = item.icon;
                const label = language === "ru" ? item.label : item.labelEn;
                if (compactMode) {
                  return (
                    <QuickAccessLinkWrapper
                      key={item.id}
                      item={item}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                      title={label}
                    >
                      <div className={`flex items-center justify-center rounded-lg p-1.5 ${item.colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </QuickAccessLinkWrapper>
                  );
                }
                return (
                  <QuickAccessLinkWrapper
                    key={item.id}
                    item={item}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                  >
                    <div className={`rounded-lg p-1.5 ${item.colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold text-gray-800">{label}</span>
                    {item.isExternal && <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />}
                  </QuickAccessLinkWrapper>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center">
              <div className="text-sm text-gray-500">{tr("Быстрый доступ пуст", "Quick access is empty")}</div>
              <button type="button" onClick={() => setDialogOpen(true)} className="mt-1.5 text-xs font-medium text-red-500 hover:text-red-600">
                {tr("Настроить", "Customize")}
              </button>
            </div>
          )}
        </div>
      </Card>
      <QuickAccessManageDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

export function AdminQuickAccessHeaderMenu() {
  const quickAccess = useAdminQuickAccess();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-gray-200 text-gray-700">
            <Pin className="mr-2 h-4 w-4" />
            {tr("Быстрый доступ", "Quick Access")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[360px] p-2">
          <DropdownMenuLabel>{tr("Быстрый доступ", "Quick Access")}</DropdownMenuLabel>
          <div className="px-2 pb-2 text-xs text-gray-500">{tr("Компактный список переходов по закреплённым admin-разделам.", "Compact navigation list for pinned admin sections.")}</div>
          <DropdownMenuSeparator />
          {quickAccess.resolvedItems.length > 0 ? (
            quickAccess.resolvedItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.id} asChild>
                  {item.isExternal ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg p-1.5 ${item.colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{language === "ru" ? item.label : item.labelEn}</div>
                        <div className="truncate text-xs text-gray-500">{language === "ru" ? item.description : item.descriptionEn}</div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-300" />
                    </a>
                  ) : (
                    <Link to={item.url} className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg p-1.5 ${item.colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{language === "ru" ? item.label : item.labelEn}</div>
                        <div className="truncate text-xs text-gray-500">{language === "ru" ? item.description : item.descriptionEn}</div>
                      </div>
                    </Link>
                  )}
                </DropdownMenuItem>
              );
            })
          ) : (
            <div className="px-2 py-3 text-sm text-gray-500">{tr("Быстрый доступ пуст. Добавьте ссылки в настройке.", "Quick access is empty. Add links in settings.")}</div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <Pin className="mr-2 h-4 w-4" />
            {tr("Настроить быстрый доступ", "Customize quick access")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <QuickAccessManageDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}