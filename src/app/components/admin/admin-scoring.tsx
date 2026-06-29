import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Edit, Loader2, Plus, RefreshCw, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "../../context/language-context";

// ── Types ──────────────────────────────────────────────────────────────────

interface ScoringGroup {
  id: number;
  name: string;
  description?: string | null;
  active?: boolean;
  rules_count?: number | null;
}

interface ScoringRule {
  id: number;
  name: string;
  type?: string | null;
  value?: number | null;
  operator?: string | null;
  active?: boolean;
  description?: string | null;
}

interface AutoRejectRule {
  id: number;
  name: string;
  type?: string | null;
  value?: number | null;
  operator?: string | null;
  active?: boolean;
  description?: string | null;
}

// ── Scoring Groups ─────────────────────────────────────────────────────────

const EMPTY_GROUP: Partial<ScoringGroup> = { name: "", description: "", active: true };

function ScoringGroupsTab({ tr }: { tr: (ru: string, en: string) => string }) {
  const [groups, setGroups] = useState<ScoringGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<ScoringGroup | null>(null);
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [groupDialog, setGroupDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<ScoringGroup | null>(null);
  const [groupForm, setGroupForm] = useState<Partial<ScoringGroup>>(EMPTY_GROUP);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editRule, setEditRule] = useState<ScoringRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<ScoringRule>>({});
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/scoring-groups", { credentials: "include" });
      const data = await res.json();
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch { toast.error(tr("Не удалось загрузить группы", "Failed to load scoring groups")); }
    finally { setIsLoading(false); }
  }, [tr]);

  const loadRules = useCallback(async (group: ScoringGroup) => {
    setSelectedGroup(group);
    setRulesLoading(true);
    try {
      const res = await fetch(`/api/admin/scoring-groups/${group.id}/rules`, { credentials: "include" });
      const data = await res.json();
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch { toast.error(tr("Не удалось загрузить правила", "Failed to load rules")); }
    finally { setRulesLoading(false); }
  }, [tr]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const saveGroup = async () => {
    if (!groupForm.name?.trim()) { toast.error(tr("Название обязательно", "Name required")); return; }
    setSaving(true);
    try {
      const url = editGroup ? `/api/admin/scoring-groups/${editGroup.id}` : "/api/admin/scoring-groups";
      const method = editGroup ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(groupForm) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      toast.success(editGroup ? tr("Группа обновлена", "Group updated") : tr("Группа создана", "Group created"));
      setGroupDialog(false);
      loadGroups();
    } catch (err) { toast.error(String((err as Error).message || err)); }
    finally { setSaving(false); }
  };

  const deleteGroup = async (g: ScoringGroup) => {
    if (!confirm(tr(`Удалить группу «${g.name}»?`, `Delete group "${g.name}"?`))) return;
    try {
      await fetch(`/api/admin/scoring-groups/${g.id}`, { method: "DELETE", credentials: "include" });
      toast.success(tr("Группа удалена", "Group deleted"));
      if (selectedGroup?.id === g.id) { setSelectedGroup(null); setRules([]); }
      loadGroups();
    } catch (err) { toast.error(String((err as Error).message || err)); }
  };

  const saveRule = async () => {
    if (!selectedGroup) return;
    if (!ruleForm.name?.trim()) { toast.error(tr("Название обязательно", "Name required")); return; }
    setSaving(true);
    try {
      const url = editRule
        ? `/api/admin/scoring-groups/${selectedGroup.id}/rules/${editRule.id}`
        : `/api/admin/scoring-groups/${selectedGroup.id}/rules`;
      const method = editRule ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ruleForm) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      toast.success(editRule ? tr("Правило обновлено", "Rule updated") : tr("Правило добавлено", "Rule added"));
      setRuleDialog(false);
      loadRules(selectedGroup);
    } catch (err) { toast.error(String((err as Error).message || err)); }
    finally { setSaving(false); }
  };

  const deleteRule = async (rule: ScoringRule) => {
    if (!selectedGroup) return;
    if (!confirm(tr(`Удалить правило «${rule.name}»?`, `Delete rule "${rule.name}"?`))) return;
    try {
      await fetch(`/api/admin/scoring-groups/${selectedGroup.id}/rules/${rule.id}`, { method: "DELETE", credentials: "include" });
      toast.success(tr("Правило удалено", "Rule deleted"));
      loadRules(selectedGroup);
    } catch (err) { toast.error(String((err as Error).message || err)); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Groups list */}
      <Card className="border-none shadow-sm lg:col-span-1">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{tr("Группы", "Groups")}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadGroups} disabled={isLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" className="h-7 bg-[#E31E24] hover:bg-[#c41a20] text-white text-xs px-2"
                onClick={() => { setEditGroup(null); setGroupForm(EMPTY_GROUP); setGroupDialog(true); }}>
                <Plus className="mr-1 h-3 w-3" />{tr("Добавить", "Add")}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{tr("Нет групп", "No groups")}</p>
          ) : groups.map((g) => (
            <div key={g.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${selectedGroup?.id === g.id ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
              onClick={() => loadRules(g)}>
              <div>
                <div className="text-sm font-medium text-gray-900">{g.name}</div>
                {g.rules_count != null && <div className="text-xs text-gray-400">{g.rules_count} {tr("правил", "rules")}</div>}
              </div>
              <div className="flex items-center gap-1">
                {g.active === false && <Badge variant="outline" className="text-xs border-gray-200 text-gray-400">{tr("выкл", "off")}</Badge>}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditGroup(g); setGroupForm({ ...g }); setGroupDialog(true); }}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteGroup(g); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="border-none shadow-sm lg:col-span-2">
        <CardContent className="p-4 space-y-3">
          {!selectedGroup ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              {tr("Выберите группу слева", "Select a group on the left")}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {tr("Правила группы", "Rules of")} «{selectedGroup.name}»
                </span>
                <Button size="sm" className="h-7 bg-[#E31E24] hover:bg-[#c41a20] text-white text-xs px-2"
                  onClick={() => { setEditRule(null); setRuleForm({ active: true }); setRuleDialog(true); }}>
                  <Plus className="mr-1 h-3 w-3" />{tr("Добавить правило", "Add rule")}
                </Button>
              </div>

              {rulesLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
              ) : rules.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">{tr("Правил нет", "No rules yet")}</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">{tr("Правило", "Rule")}</th>
                        <th className="px-3 py-2 font-medium">{tr("Тип", "Type")}</th>
                        <th className="px-3 py-2 font-medium">{tr("Значение", "Value")}</th>
                        <th className="px-3 py-2 font-medium">{tr("Статус", "Status")}</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{rule.name}</div>
                            {rule.description && <div className="text-xs text-gray-400">{rule.description}</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{rule.type || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{rule.operator} {rule.value ?? "—"}</td>
                          <td className="px-3 py-2">
                            {rule.active === false
                              ? <Badge variant="outline" className="border-gray-200 text-gray-400 text-xs">{tr("выкл", "off")}</Badge>
                              : <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-xs">{tr("вкл", "on")}</Badge>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRule(rule); setRuleForm({ ...rule }); setRuleDialog(true); }}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => deleteRule(rule)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Group dialog */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editGroup ? tr("Редактировать группу", "Edit group") : tr("Новая группа", "New group")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{tr("Название *", "Name *")}</Label>
              <Input value={groupForm.name || ""} onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{tr("Описание", "Description")}</Label>
              <Textarea rows={2} value={groupForm.description || ""} onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(groupForm.active !== false)} onCheckedChange={(v) => setGroupForm((p) => ({ ...p, active: v }))} id="g-active" />
              <Label htmlFor="g-active">{tr("Активна", "Active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)} disabled={saving}>{tr("Отмена", "Cancel")}</Button>
            <Button onClick={saveGroup} disabled={saving} className="bg-[#E31E24] hover:bg-[#c41a20] text-white">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{tr("Сохранить", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule dialog */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editRule ? tr("Редактировать правило", "Edit rule") : tr("Новое правило", "New rule")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{tr("Название *", "Name *")}</Label>
              <Input value={ruleForm.name || ""} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{tr("Тип", "Type")}</Label>
                <Input value={ruleForm.type || ""} onChange={(e) => setRuleForm((p) => ({ ...p, type: e.target.value }))} placeholder="score" />
              </div>
              <div className="space-y-1">
                <Label>{tr("Оператор", "Operator")}</Label>
                <Select value={ruleForm.operator || ""} onValueChange={(v) => setRuleForm((p) => ({ ...p, operator: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {["gt", "lt", "gte", "lte", "eq", "neq"].map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tr("Значение", "Value")}</Label>
                <Input type="number" value={ruleForm.value ?? ""} onChange={(e) => setRuleForm((p) => ({ ...p, value: e.target.value === "" ? undefined : Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr("Описание", "Description")}</Label>
              <Textarea rows={2} value={ruleForm.description || ""} onChange={(e) => setRuleForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(ruleForm.active !== false)} onCheckedChange={(v) => setRuleForm((p) => ({ ...p, active: v }))} id="r-active" />
              <Label htmlFor="r-active">{tr("Активно", "Active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)} disabled={saving}>{tr("Отмена", "Cancel")}</Button>
            <Button onClick={saveRule} disabled={saving} className="bg-[#E31E24] hover:bg-[#c41a20] text-white">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{tr("Сохранить", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── AutoReject Rules ───────────────────────────────────────────────────────

const EMPTY_AR: Partial<AutoRejectRule> = { name: "", active: true };

function AutoRejectTab({ tr }: { tr: (ru: string, en: string) => string }) {
  const [rules, setRules] = useState<AutoRejectRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editRule, setEditRule] = useState<AutoRejectRule | null>(null);
  const [form, setForm] = useState<Partial<AutoRejectRule>>(EMPTY_AR);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/auto-reject-rules", { credentials: "include" });
      const data = await res.json();
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch { toast.error(tr("Не удалось загрузить правила", "Failed to load rules")); }
    finally { setIsLoading(false); }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name?.trim()) { toast.error(tr("Название обязательно", "Name required")); return; }
    setSaving(true);
    try {
      const url = editRule ? `/api/admin/auto-reject-rules/${editRule.id}` : "/api/admin/auto-reject-rules";
      const method = editRule ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      toast.success(editRule ? tr("Правило обновлено", "Rule updated") : tr("Правило создано", "Rule created"));
      setDialog(false);
      load();
    } catch (err) { toast.error(String((err as Error).message || err)); }
    finally { setSaving(false); }
  };

  const del = async (rule: AutoRejectRule) => {
    if (!confirm(tr(`Удалить правило «${rule.name}»?`, `Delete rule "${rule.name}"?`))) return;
    try {
      await fetch(`/api/admin/auto-reject-rules/${rule.id}`, { method: "DELETE", credentials: "include" });
      toast.success(tr("Удалено", "Deleted"));
      load();
    } catch (err) { toast.error(String((err as Error).message || err)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{tr("PIREPs с нарушениями автоматически отклоняются по этим правилам.", "PIREPs violating these rules are auto-rejected.")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={() => { setEditRule(null); setForm(EMPTY_AR); setDialog(true); }}>
            <Plus className="mr-1 h-4 w-4" />{tr("Добавить", "Add rule")}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{tr("Правило", "Rule")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Тип", "Type")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Условие", "Condition")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Статус", "Status")}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></td></tr>
                ) : rules.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">{tr("Правил нет", "No rules")}</td></tr>
                ) : rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{rule.name}</div>
                          {rule.description && <div className="text-xs text-gray-400">{rule.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{rule.type || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{rule.operator} {rule.value ?? "—"}</td>
                    <td className="px-4 py-3">
                      {rule.active === false
                        ? <Badge variant="outline" className="border-gray-200 text-gray-400 text-xs">{tr("выкл", "off")}</Badge>
                        : <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs">{tr("активно", "active")}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditRule(rule); setForm({ ...rule }); setDialog(true); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => del(rule)}>
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editRule ? tr("Редактировать", "Edit rule") : tr("Новое правило", "New rule")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{tr("Название *", "Name *")}</Label>
              <Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{tr("Тип", "Type")}</Label>
                <Input value={form.type || ""} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} placeholder="landing_rate" />
              </div>
              <div className="space-y-1">
                <Label>{tr("Оператор", "Operator")}</Label>
                <Select value={form.operator || ""} onValueChange={(v) => setForm((p) => ({ ...p, operator: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {["gt", "lt", "gte", "lte", "eq", "neq"].map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tr("Значение", "Value")}</Label>
                <Input type="number" value={form.value ?? ""} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value === "" ? undefined : Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr("Описание", "Description")}</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(form.active !== false)} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} id="ar-active" />
              <Label htmlFor="ar-active">{tr("Активно", "Active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving}>{tr("Отмена", "Cancel")}</Button>
            <Button onClick={save} disabled={saving} className="bg-[#E31E24] hover:bg-[#c41a20] text-white">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{tr("Сохранить", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export function AdminScoring() {
  const { language } = useLanguage();
  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{tr("Скоринг", "Scoring")}</h2>
        <p className="text-sm text-gray-500">{tr("Группы правил начисления очков и автоотклонения PIREPs", "Scoring rule groups and PIREP auto-reject rules")}</p>
      </div>

      <Tabs defaultValue="groups">
        <TabsList className="bg-transparent p-0 gap-2">
          <TabsTrigger value="groups" className="border border-gray-200 bg-white px-4 data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
            {tr("Группы правил", "Scoring Groups")}
          </TabsTrigger>
          <TabsTrigger value="autoreject" className="border border-gray-200 bg-white px-4 data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
            {tr("Автоотклонение", "Auto-Reject")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-4">
          <ScoringGroupsTab tr={tr} />
        </TabsContent>
        <TabsContent value="autoreject" className="mt-4">
          <AutoRejectTab tr={tr} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
