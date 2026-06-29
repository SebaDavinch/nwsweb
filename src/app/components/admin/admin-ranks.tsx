import { useCallback, useEffect, useState } from "react";
import { Edit, Loader2, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "../../context/language-context";

interface RankItem {
  id: number;
  name: string;
  code?: string | null;
  order: number;
  hours_required?: number | null;
  flights_required?: number | null;
  points_required?: number | null;
  honorary?: boolean;
  description?: string | null;
  pilot_count?: number | null;
}

const EMPTY_FORM: Partial<RankItem> = {
  name: "",
  code: "",
  order: 0,
  hours_required: null,
  flights_required: null,
  points_required: null,
  honorary: false,
  description: "",
};

export function AdminRanks() {
  const { language } = useLanguage();
  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);

  const [ranks, setRanks] = useState<RankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RankItem | null>(null);
  const [form, setForm] = useState<Partial<RankItem>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/ranks", { credentials: "include" });
      const data = await res.json();
      setRanks(Array.isArray(data.ranks) ? data.ranks : []);
    } catch {
      toast.error(tr("Не удалось загрузить ранги", "Failed to load ranks"));
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rank: RankItem) => {
    setEditItem(rank);
    setForm({ ...rank });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error(tr("Название обязательно", "Name is required"));
      return;
    }
    setSaving(true);
    try {
      const url = editItem ? `/api/admin/ranks/${editItem.id}` : "/api/admin/ranks";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code || undefined,
          order: Number(form.order) || 0,
          hours_required: form.hours_required != null ? Number(form.hours_required) : null,
          flights_required: form.flights_required != null ? Number(form.flights_required) : null,
          points_required: form.points_required != null ? Number(form.points_required) : null,
          honorary: Boolean(form.honorary),
          description: form.description || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || res.statusText);
      }
      toast.success(editItem ? tr("Ранг обновлён", "Rank updated") : tr("Ранг создан", "Rank created"));
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rank: RankItem) => {
    if (!confirm(tr(`Удалить ранг «${rank.name}»?`, `Delete rank "${rank.name}"?`))) return;
    setDeletingId(rank.id);
    try {
      const res = await fetch(`/api/admin/ranks/${rank.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || res.statusText);
      }
      toast.success(tr("Ранг удалён", "Rank deleted"));
      load();
    } catch (err) {
      toast.error(String((err as Error).message || err));
    } finally {
      setDeletingId(null);
    }
  };

  const setField = <K extends keyof RankItem>(key: K, value: RankItem[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{tr("Ранги", "Ranks")}</h2>
          <p className="text-sm text-gray-500">{tr("Система прогрессии пилотов в vAMSYS", "Pilot progression system in vAMSYS")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-[#E31E24] hover:bg-[#c41a20] text-white">
            <Plus className="mr-1 h-4 w-4" />
            {tr("Добавить ранг", "Add rank")}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">{tr("Ранг", "Rank")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Часы", "Hours")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Рейсы", "Flights")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Очки", "Points")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Пилоты", "Pilots")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Тип", "Type")}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td></tr>
                ) : ranks.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {tr("Ранги не найдены", "No ranks found")}
                  </td></tr>
                ) : ranks.map((rank) => (
                  <tr key={rank.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{rank.order}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        <div>
                          <div className="font-medium text-gray-900">{rank.name}</div>
                          {rank.code && <div className="text-xs text-gray-400">{rank.code}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{rank.hours_required ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{rank.flights_required ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{rank.points_required ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{rank.pilot_count ?? "—"}</td>
                    <td className="px-4 py-3">
                      {rank.honorary
                        ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{tr("Почётный", "Honorary")}</Badge>
                        : <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{tr("Обычный", "Standard")}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rank)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(rank)} disabled={deletingId === rank.id}>
                          {deletingId === rank.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? tr("Редактировать ранг", "Edit rank") : tr("Новый ранг", "New rank")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{tr("Название *", "Name *")}</Label>
                <Input value={form.name || ""} onChange={(e) => setField("name", e.target.value)} placeholder="Captain" />
              </div>
              <div className="space-y-1">
                <Label>{tr("Код", "Code")}</Label>
                <Input value={form.code || ""} onChange={(e) => setField("code", e.target.value)} placeholder="CPT" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{tr("Порядок", "Order")}</Label>
                <Input type="number" value={form.order ?? ""} onChange={(e) => setField("order", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>{tr("Часы", "Hours req.")}</Label>
                <Input type="number" value={form.hours_required ?? ""} onChange={(e) => setField("hours_required", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" />
              </div>
              <div className="space-y-1">
                <Label>{tr("Рейсы", "Flights req.")}</Label>
                <Input type="number" value={form.flights_required ?? ""} onChange={(e) => setField("flights_required", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr("Очки (минимум)", "Points required")}</Label>
              <Input type="number" value={form.points_required ?? ""} onChange={(e) => setField("points_required", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" />
            </div>
            <div className="space-y-1">
              <Label>{tr("Описание", "Description")}</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setField("description", e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(form.honorary)} onCheckedChange={(v) => setField("honorary", v)} id="honorary" />
              <Label htmlFor="honorary">{tr("Почётный ранг (не требует прогрессии)", "Honorary rank (no progression required)")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{tr("Отмена", "Cancel")}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#E31E24] hover:bg-[#c41a20] text-white">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {tr("Сохранить", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
