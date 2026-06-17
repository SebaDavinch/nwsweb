import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Clock,
  Plane,
  Award,
  Camera,
  LayoutGrid,
  List,
  Loader2,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  X,
  FolderOpen,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface CatalogTier {
  id: string;
  threshold: number;
  labelRu: string;
  labelEn: string;
  rewardBadgeId?: string | null;
}
interface CatalogAchievement {
  id: string;
  metric: string;
  categoryId?: string | null;
  titleRu: string;
  titleEn: string;
  icon: string;
  tiers: CatalogTier[];
}
interface CatalogCategory {
  id: string;
  titleRu: string;
  titleEn: string;
  icon: string;
  order: number;
}
interface MetricOption {
  id: string;
  labelRu: string;
  labelEn: string;
}
interface BadgeOption {
  id: string;
  title: string;
  source: string;
}

const ICON_NODES: Record<string, React.ReactNode> = {
  clock: <Clock className="h-5 w-5" />,
  plane: <Plane className="h-5 w-5" />,
  award: <Award className="h-5 w-5" />,
  camera: <Camera className="h-5 w-5" />,
  trophy: <Trophy className="h-5 w-5" />,
};

const NO_BADGE = "__none__";
const NO_CATEGORY = "__none__";

const cloneAchievement = (a: CatalogAchievement): CatalogAchievement => JSON.parse(JSON.stringify(a));

const blankAchievement = (): CatalogAchievement => ({
  id: `ach-${Date.now().toString(36)}`,
  metric: "hours",
  categoryId: null,
  titleRu: "",
  titleEn: "",
  icon: "trophy",
  tiers: [],
});

export function AdminAchievements() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [items, setItems] = useState<CatalogAchievement[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [metrics, setMetrics] = useState<MetricOption[]>([]);
  const [icons, setIcons] = useState<string[]>([]);
  const [badges, setBadges] = useState<BadgeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [showCategories, setShowCategories] = useState(false);

  const [editing, setEditing] = useState<CatalogAchievement | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/achievements/catalog", { credentials: "include" });
      const p = res.ok ? await res.json() : null;
      if (Array.isArray(p?.achievements)) setItems(p.achievements);
      if (Array.isArray(p?.categories)) setCategories(p.categories);
      if (Array.isArray(p?.metrics)) setMetrics(p.metrics);
      if (Array.isArray(p?.icons)) setIcons(p.icons);
      if (Array.isArray(p?.badges)) setBadges(p.badges);
      setDirty(false);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const title = (a: CatalogAchievement) => (language === "ru" ? a.titleRu : a.titleEn) || a.titleRu || a.titleEn || a.id;
  const tierLabel = (t: CatalogTier) => (language === "ru" ? t.labelRu : t.labelEn) || t.labelRu || t.labelEn || `${t.threshold}`;
  const catTitle = (c: CatalogCategory) => (language === "ru" ? c.titleRu : c.titleEn) || c.titleRu || c.titleEn || c.id;
  const metricLabel = (id: string) => {
    const m = metrics.find((x) => x.id === id);
    return m ? (language === "ru" ? m.labelRu : m.labelEn) : id;
  };
  const totalGoals = useMemo(() => items.reduce((sum, a) => sum + a.tiers.length, 0), [items]);

  // Группировка достижений по категориям (для отображения), сохраняя исходный индекс.
  const groups = useMemo(() => {
    const sortedCats = categories.slice().sort((a, b) => a.order - b.order);
    const indexed = items.map((a, index) => ({ a, index }));
    const result: Array<{ category: CatalogCategory | null; entries: typeof indexed }> = [];
    for (const c of sortedCats) {
      const entries = indexed.filter((e) => e.a.categoryId === c.id);
      if (entries.length) result.push({ category: c, entries });
    }
    const known = new Set(sortedCats.map((c) => c.id));
    const orphans = indexed.filter((e) => !e.a.categoryId || !known.has(e.a.categoryId));
    if (orphans.length) result.push({ category: null, entries: orphans });
    return result;
  }, [items, categories]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/achievements/catalog", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievements: items, categories }),
      });
      const p = res.ok ? await res.json() : null;
      if (p?.ok) {
        if (Array.isArray(p.achievements)) setItems(p.achievements);
        if (Array.isArray(p.categories)) setCategories(p.categories);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm(tr("Сбросить каталог достижений к стандартным значениям?", "Reset the achievement catalog to defaults?"))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/achievements/catalog/reset", { method: "POST", credentials: "include" });
      const p = res.ok ? await res.json() : null;
      if (p?.ok) {
        if (Array.isArray(p.achievements)) setItems(p.achievements);
        if (Array.isArray(p.categories)) setCategories(p.categories);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Категории ──
  const addCategory = () => {
    setCategories((cur) => [
      ...cur,
      { id: `cat-${Date.now().toString(36)}`, titleRu: "", titleEn: "", icon: "trophy", order: cur.length + 1 },
    ]);
    setDirty(true);
  };
  const updateCategory = (index: number, patch: Partial<CatalogCategory>) => {
    setCategories((cur) => cur.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    setDirty(true);
  };
  const removeCategory = (index: number) => {
    setCategories((cur) => cur.filter((_, i) => i !== index));
    setDirty(true);
  };

  // ── Достижения ──
  const openEdit = (index: number) => {
    setEditingIndex(index);
    setEditing(cloneAchievement(items[index]));
  };
  const openAdd = () => {
    setEditingIndex(-1);
    setEditing(blankAchievement());
  };
  const removeAchievement = (index: number) => {
    if (!window.confirm(tr("Удалить достижение?", "Delete this achievement?"))) return;
    setItems((cur) => cur.filter((_, i) => i !== index));
    setDirty(true);
  };
  const commitEditing = () => {
    if (!editing) return;
    const draft: CatalogAchievement = {
      ...editing,
      id: editing.id.trim() || `ach-${Date.now().toString(36)}`,
      categoryId: editing.categoryId || null,
      tiers: editing.tiers
        .filter((t) => Number.isFinite(Number(t.threshold)))
        .sort((a, b) => Number(a.threshold) - Number(b.threshold)),
    };
    setItems((cur) => {
      if (editingIndex >= 0) {
        const next = cur.slice();
        next[editingIndex] = draft;
        return next;
      }
      return [...cur, draft];
    });
    setDirty(true);
    setEditing(null);
    setEditingIndex(-1);
  };

  const renderCard = (a: CatalogAchievement, index: number) => (
    <Card key={a.id} className="border-none shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white">
            {ICON_NODES[a.icon] || <Trophy className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-gray-900">{title(a)}</div>
            <div className="text-xs text-gray-400">
              {tr("метрика", "metric")}: <span className="font-mono">{a.metric}</span> · {a.tiers.length} {tr("целей", "goals")}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-500" onClick={() => openEdit(index)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeAchievement(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.tiers.map((t) => (
            <span
              key={t.id}
              title={`${t.threshold}${t.rewardBadgeId ? ` → ${t.rewardBadgeId}` : ""}`}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
            >
              {tierLabel(t)}
              {t.rewardBadgeId ? <Link2 className="h-2.5 w-2.5 text-amber-500" /> : null}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderRow = (a: CatalogAchievement, index: number) => {
    const linked = a.tiers.filter((t) => t.rewardBadgeId).length;
    return (
      <TableRow key={a.id}>
        <TableCell>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              {ICON_NODES[a.icon] || <Trophy className="h-3.5 w-3.5" />}
            </span>
            <div>
              <div className="font-medium text-gray-900">{title(a)}</div>
              <div className="font-mono text-[11px] text-gray-400">{a.id}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="font-mono">{metricLabel(a.metric)}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {a.tiers.map((t) => (
              <Badge key={t.id} variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
                {tierLabel(t)}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          {linked > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Link2 className="h-3.5 w-3.5" />
              {linked}
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(index)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeAchievement(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Trophy className="h-6 w-6 text-amber-500" />
            {tr("Достижения", "Achievements")}
          </h2>
          <p className="text-sm text-gray-500">
            {tr(
              `Редактор каталога (data/achievements-catalog.json). ${items.length} достижений · ${totalGoals} целей · ${categories.length} категорий.`,
              `Catalog editor (data/achievements-catalog.json). ${items.length} achievements · ${totalGoals} goals · ${categories.length} categories.`
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
            <Button type="button" variant={view === "cards" ? "default" : "ghost"} size="sm" className={view === "cards" ? "bg-[#E31E24] hover:bg-[#c41a20] text-white" : "text-gray-600"} onClick={() => setView("cards")}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              {tr("Карточки", "Cards")}
            </Button>
            <Button type="button" variant={view === "list" ? "default" : "ghost"} size="sm" className={view === "list" ? "bg-[#E31E24] hover:bg-[#c41a20] text-white" : "text-gray-600"} onClick={() => setView("list")}>
              <List className="mr-2 h-4 w-4" />
              {tr("Список", "List")}
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCategories((v) => !v)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            {tr("Категории", "Categories")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {tr("Добавить", "Add")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void resetDefaults()} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {tr("Сбросить", "Reset")}
          </Button>
          <Button type="button" size="sm" className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {tr("Сохранить", "Save")}
          </Button>
        </div>
      </div>

      {dirty ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {tr("Есть несохранённые изменения.", "You have unsaved changes.")}
        </div>
      ) : null}

      {/* Управление категориями */}
      {showCategories ? (
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">{tr("Категории достижений", "Achievement categories")}</div>
              <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {tr("Категория", "Category")}
              </Button>
            </div>
            {categories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                {tr("Категорий нет.", "No categories.")}
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((c, i) => (
                  <div key={c.id} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-2.5 sm:grid-cols-[1fr_1fr_140px_90px_auto] sm:items-center">
                    <Input value={c.titleRu} placeholder={tr("Название RU", "Title RU")} onChange={(e) => updateCategory(i, { titleRu: e.target.value })} />
                    <Input value={c.titleEn} placeholder={tr("Название EN", "Title EN")} onChange={(e) => updateCategory(i, { titleEn: e.target.value })} />
                    <Select value={c.icon} onValueChange={(v) => updateCategory(i, { icon: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {icons.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={c.order} placeholder="#" onChange={(e) => updateCategory(i, { order: Number(e.target.value) || 0 })} />
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => removeCategory(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500">
          {tr("Каталог достижений пуст.", "Achievement catalog is empty.")}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category?.id || "uncategorized"} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {group.category ? (ICON_NODES[group.category.icon] || <Trophy className="h-4 w-4" />) : <FolderOpen className="h-4 w-4" />}
                {group.category ? catTitle(group.category) : tr("Без категории", "Uncategorized")}
                <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500">{group.entries.length}</Badge>
              </div>
              {view === "cards" ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {group.entries.map((e) => renderCard(e.a, e.index))}
                </div>
              ) : (
                <Card className="border-none shadow-sm">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr("Достижение", "Achievement")}</TableHead>
                          <TableHead>{tr("Метрика", "Metric")}</TableHead>
                          <TableHead>{tr("Цели", "Goals")}</TableHead>
                          <TableHead>{tr("Бейджи", "Badges")}</TableHead>
                          <TableHead className="text-right">{tr("Действия", "Actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>{group.entries.map((e) => renderRow(e.a, e.index))}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Диалог редактирования достижения */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditingIndex(-1); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingIndex >= 0 ? tr("Изменить достижение", "Edit achievement") : tr("Новое достижение", "New achievement")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4 py-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tr("Название (RU)", "Title (RU)")}</Label>
                  <Input value={editing.titleRu} onChange={(e) => setEditing({ ...editing, titleRu: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Название (EN)", "Title (EN)")}</Label>
                  <Input value={editing.titleEn} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Категория", "Category")}</Label>
                  <Select value={editing.categoryId || NO_CATEGORY} onValueChange={(v) => setEditing({ ...editing, categoryId: v === NO_CATEGORY ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>{tr("Без категории", "Uncategorized")}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{language === "ru" ? c.titleRu : c.titleEn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Метрика", "Metric")}</Label>
                  <Select value={editing.metric} onValueChange={(v) => setEditing({ ...editing, metric: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{language === "ru" ? m.labelRu : m.labelEn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("Иконка", "Icon")}</Label>
                  <Select value={editing.icon} onValueChange={(v) => setEditing({ ...editing, icon: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {icons.map((ic) => (
                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{tr("Цели", "Goals")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        tiers: [
                          ...editing.tiers,
                          { id: `${editing.id}-${Date.now().toString(36)}`, threshold: 0, labelRu: "", labelEn: "", rewardBadgeId: null },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {tr("Цель", "Goal")}
                  </Button>
                </div>
                {editing.tiers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                    {tr("Целей нет. Добавьте хотя бы одну.", "No goals. Add at least one.")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editing.tiers.map((t, ti) => (
                      <div key={t.id} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-2.5 sm:grid-cols-[80px_1fr_1fr_1fr_auto] sm:items-center">
                        <Input
                          type="number"
                          value={t.threshold}
                          placeholder={tr("Порог", "Threshold")}
                          onChange={(e) => {
                            const tiers = editing.tiers.slice();
                            tiers[ti] = { ...t, threshold: Number(e.target.value) || 0 };
                            setEditing({ ...editing, tiers });
                          }}
                        />
                        <Input
                          value={t.labelRu}
                          placeholder={tr("Подпись RU", "Label RU")}
                          onChange={(e) => {
                            const tiers = editing.tiers.slice();
                            tiers[ti] = { ...t, labelRu: e.target.value };
                            setEditing({ ...editing, tiers });
                          }}
                        />
                        <Input
                          value={t.labelEn}
                          placeholder={tr("Подпись EN", "Label EN")}
                          onChange={(e) => {
                            const tiers = editing.tiers.slice();
                            tiers[ti] = { ...t, labelEn: e.target.value };
                            setEditing({ ...editing, tiers });
                          }}
                        />
                        <Select
                          value={t.rewardBadgeId || NO_BADGE}
                          onValueChange={(v) => {
                            const tiers = editing.tiers.slice();
                            tiers[ti] = { ...t, rewardBadgeId: v === NO_BADGE ? null : v };
                            setEditing({ ...editing, tiers });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={tr("Бейдж", "Badge")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_BADGE}>{tr("Без бейджа", "No badge")}</SelectItem>
                            {badges.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.title} ({b.source === "operations" ? "vAMSYS" : "Nordwind"})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-red-500 hover:bg-red-50"
                          onClick={() => setEditing({ ...editing, tiers: editing.tiers.filter((_, i) => i !== ti) })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setEditing(null); setEditingIndex(-1); }}>
              {tr("Отмена", "Cancel")}
            </Button>
            <Button type="button" className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={commitEditing}>
              {tr("Применить", "Apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
