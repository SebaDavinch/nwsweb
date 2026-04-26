import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { CalendarDays, Loader2, Pencil, Plus, RefreshCw, Search, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "../../context/language-context";

type ActivityView = "events" | "focus-airports" | "rosters" | "curated-rosters" | "community";
type ActivitySection = "events" | "focus-airports" | "rosters" | "community-goals" | "community-challenges";

type EditorMode = "create" | "edit";

interface ActivityCatalogItem {
  id: string;
  originalId: number;
  type: string;
  subtype?: string | null;
  name: string;
  description?: string | null;
  tags?: string[];
  start?: string | null;
  end?: string | null;
  showFrom?: string | null;
  status?: string | null;
  registrationOpen?: boolean;
  target?: string | null;
  registrationCount?: number | null;
  completionCount?: number | null;
  points?: number | null;
  updatedAt?: string | null;
}

const EVENT_VIEWS: Array<{ value: ActivityView; labelKey: string }> = [
  { value: "events", labelKey: "admin.events.view.events" },
  { value: "focus-airports", labelKey: "admin.events.view.focusAirports" },
  { value: "rosters", labelKey: "admin.events.view.rosters" },
  { value: "curated-rosters", labelKey: "admin.events.view.curatedRosters" },
  { value: "community", labelKey: "admin.events.view.community" },
];

const SECTION_LABELS: Record<ActivitySection, string> = {
  events: "admin.events.view.events",
  "focus-airports": "admin.events.view.focusAirports",
  rosters: "admin.events.view.rosters",
  "community-goals": "Community Goals",
  "community-challenges": "Community Challenges",
};

const normalizeView = (value: string | null): ActivityView => {
  if (value === "focus-airports" || value === "rosters" || value === "curated-rosters" || value === "community") {
    return value;
  }
  return "events";
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const isCuratedRoster = (item: ActivityCatalogItem) => {
  if (String(item.type || "") !== "Roster") {
    return false;
  }

  const subtype = String(item.subtype || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag || "").toLowerCase()) : [];
  return subtype.includes("curated") || name.includes("curated") || tags.some((tag) => tag.includes("curated"));
};

const matchesView = (item: ActivityCatalogItem, view: ActivityView) => {
  if (view === "events") {
    return item.type === "Event";
  }
  if (view === "focus-airports") {
    return item.type === "FocusAirport";
  }
  if (view === "rosters") {
    return item.type === "Roster" && !isCuratedRoster(item);
  }
  if (view === "curated-rosters") {
    return item.type === "Roster" && isCuratedRoster(item);
  }
  return item.type === "CommunityGoal" || item.type === "CommunityChallenge";
};

const resolveActivitySectionByType = (item: ActivityCatalogItem): ActivitySection => {
  if (item.type === "FocusAirport") return "focus-airports";
  if (item.type === "Roster") return "rosters";
  if (item.type === "CommunityGoal") return "community-goals";
  if (item.type === "CommunityChallenge") return "community-challenges";
  return "events";
};

const resolveDefaultSectionForView = (view: ActivityView): ActivitySection => {
  if (view === "focus-airports") return "focus-airports";
  if (view === "rosters" || view === "curated-rosters") return "rosters";
  if (view === "community") return "community-goals";
  return "events";
};

const nowIso = () => new Date().toISOString();
const tomorrowIso = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const buildDefaultPayload = (section: ActivitySection) => {
  if (section === "events") {
    return {
      name: "New Event",
      subtype: "routes",
      description: "",
      points: 0,
      time_award_scale: 3,
      start: nowIso(),
      end: tomorrowIso(),
      show_from: nowIso(),
      allow_repeat_participation: false,
      registration_required: false,
    };
  }
  if (section === "focus-airports") {
    return {
      name: "New Focus Airport",
      description: "",
      points: 0,
      time_award_scale: 3,
      start: nowIso(),
      end: tomorrowIso(),
      show_from: nowIso(),
      airport_ids: [],
    };
  }
  if (section === "rosters") {
    return {
      name: "New Roster",
      subtype: "standard",
      description: "",
      points: 0,
      time_award_scale: 3,
      start: nowIso(),
      end: tomorrowIso(),
      show_from: nowIso(),
      tags: [],
    };
  }
  if (section === "community-challenges") {
    return {
      name: "New Community Challenge",
      description: "",
      points: 0,
      start: nowIso(),
      end: tomorrowIso(),
      show_from: nowIso(),
      teams: [
        { name: "Team A", target: 100 },
        { name: "Team B", target: 100 },
      ],
    };
  }
  return {
    name: "New Community Goal",
    description: "",
    points: 0,
    target: 100,
    unit: "",
    start: nowIso(),
    end: tomorrowIso(),
    show_from: nowIso(),
  };
};

const getSectionOptionsForView = (view: ActivityView): ActivitySection[] => {
  if (view === "community") {
    return ["community-goals", "community-challenges"];
  }
  if (view === "focus-airports") {
    return ["focus-airports"];
  }
  if (view === "rosters" || view === "curated-rosters") {
    return ["rosters"];
  }
  return ["events"];
};

const viewSubtitleKey = (view: ActivityView): string => {
  if (view === "focus-airports") return "admin.events.subtitle.focusAirports";
  if (view === "rosters") return "admin.events.subtitle.rosters";
  if (view === "curated-rosters") return "admin.events.subtitle.curatedRosters";
  if (view === "community") return "admin.events.subtitle.community";
  return "admin.events.subtitle.events";
};

export function AdminEvents() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ActivityCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [query, setQuery] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editorSection, setEditorSection] = useState<ActivitySection>("events");
  const [editingItem, setEditingItem] = useState<ActivityCatalogItem | null>(null);
  const [payloadText, setPayloadText] = useState("{}");

  const currentView = normalizeView(searchParams.get("view"));

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/activities", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load activities");
      }
      const payload = await response.json() as { activities?: ActivityCatalogItem[] };
      setItems(Array.isArray(payload.activities) ? payload.activities : []);
    } catch (error) {
      console.error("Failed to load activities center", error);
      setItems([]);
      toast.error(t("admin.events.error.load"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const counts = useMemo(() => ({
    events: items.filter((item) => matchesView(item, "events")).length,
    "focus-airports": items.filter((item) => matchesView(item, "focus-airports")).length,
    rosters: items.filter((item) => matchesView(item, "rosters")).length,
    "curated-rosters": items.filter((item) => matchesView(item, "curated-rosters")).length,
    community: items.filter((item) => matchesView(item, "community")).length,
  }), [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => matchesView(item, currentView))
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }
        return [
          item.name,
          item.description,
          item.subtype,
          item.target,
          item.status,
          ...(Array.isArray(item.tags) ? item.tags : []),
        ]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(normalizedQuery));
      });
  }, [currentView, items, query]);

  const activeViewLabel = t(EVENT_VIEWS.find((item) => item.value === currentView)?.labelKey || "admin.events.view.events");
  const sectionOptions = getSectionOptionsForView(currentView);

  const openCreateDialog = () => {
    const defaultSection = resolveDefaultSectionForView(currentView);
    setEditorMode("create");
    setEditingItem(null);
    setEditorSection(defaultSection);
    setPayloadText(JSON.stringify(buildDefaultPayload(defaultSection), null, 2));
    setEditorOpen(true);
  };

  const openEditDialog = async (item: ActivityCatalogItem) => {
    const section = resolveActivitySectionByType(item);
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/activities/${section}/${item.originalId}`, { credentials: "include" });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; activity?: unknown };
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setEditorMode("edit");
      setEditorSection(section);
      setEditingItem(item);
      setPayloadText(JSON.stringify(data.activity || {}, null, 2));
      setEditorOpen(true);
    } catch (error) {
      toast.error(String((error as Error)?.message || "Failed to load activity detail"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (item: ActivityCatalogItem) => {
    const section = resolveActivitySectionByType(item);
    const confirmed = window.confirm(`Delete ${item.name || `${item.type} ${item.originalId}`}?`);
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/activities/${section}/${item.originalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      toast.success("Activity deleted");
      await loadItems();
    } catch (error) {
      toast.error(String((error as Error)?.message || t("admin.events.error.delete")));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async () => {
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      toast.error(t("admin.events.error.invalidJson"));
      return;
    }

    setIsBusy(true);
    try {
      const endpoint = editorMode === "create"
        ? `/api/admin/activities/${editorSection}`
        : `/api/admin/activities/${editorSection}/${editingItem?.originalId || 0}`;
      const response = await fetch(endpoint, {
        method: editorMode === "create" ? "POST" : "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      toast.success(editorMode === "create" ? t("admin.events.success.created") : t("admin.events.success.updated"));
      setEditorOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(String((error as Error)?.message || t("admin.events.error.save")));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t("admin.events.title")}</h2>
          <p className="text-sm text-gray-500">{t(viewSubtitleKey(currentView))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog} className="bg-[#E31E24] hover:bg-[#c41a20]">
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.events.new")} {activeViewLabel}
          </Button>
          <Button variant="outline" onClick={() => void loadItems()} disabled={isLoading || isBusy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("admin.events.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {EVENT_VIEWS.map((view) => (
          <Card key={view.value} className={currentView === view.value ? "border-[#E31E24] shadow-sm" : "border-gray-200"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">{t(view.labelKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{counts[view.value]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <Tabs value={currentView} onValueChange={(value) => setSearchParams({ view: normalizeView(value) })}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
              {EVENT_VIEWS.map((view) => (
                <TabsTrigger key={view.value} value={view.value} className="border border-gray-200 data-[state=active]:border-[#E31E24] data-[state=active]:bg-[#E31E24] data-[state=active]:text-white">
                  {t(view.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t("admin.events.search")} ${activeViewLabel.toLowerCase()}...`} className="pl-9" />
            </div>
            <div className="text-sm text-gray-500">{filteredItems.length} {t("admin.events.items")}</div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("admin.events.table.name")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.events.table.type")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.events.table.window")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.events.table.target")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.events.table.progress")}</th>
                  <th className="px-4 py-3 font-medium">{t("admin.events.table.updated")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("admin.events.table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("admin.events.loading")}
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="font-medium text-gray-900">{item.name || `${item.type} ${item.originalId}`}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="outline">#{item.originalId}</Badge>
                          {item.subtype ? <Badge variant="outline" className="capitalize">{item.subtype}</Badge> : null}
                          {Array.isArray(item.tags) ? item.tags.slice(0, 3).map((tag) => (
                            <Badge key={`${item.id}-${tag}`} variant="outline" className="capitalize">{tag}</Badge>
                          )) : null}
                          {item.registrationOpen ? <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">{t("admin.events.registrationOpen")}</Badge> : null}
                        </div>
                        {item.description ? <div className="mt-2 line-clamp-2 max-w-2xl text-xs text-gray-500">{item.description}</div> : null}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="space-y-1">
                          <Badge variant="outline">{item.type}</Badge>
                          <div className="text-xs text-gray-500 capitalize">{item.status || t("admin.events.na")}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="space-y-1 text-xs">
                          <div className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-gray-400" /><span>{formatDateTime(item.start)}</span></div>
                          <div className="text-gray-500">{t("admin.events.to")} {formatDateTime(item.end)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="inline-flex items-start gap-2 text-xs">
                          <Target className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
                          <span>{item.target || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="space-y-1 text-xs text-gray-500">
                          <div>{t("admin.events.registrations")} {Number(item.registrationCount || 0)}</div>
                          <div>{t("admin.events.completions")} {Number(item.completionCount || 0)}</div>
                          <div>{t("admin.events.points")} {Number(item.points || 0)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-500">{formatDateTime(item.updatedAt)}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void openEditDialog(item)} disabled={isBusy}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("admin.events.edit")}
                          </Button>
                          <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void handleDelete(item)} disabled={isBusy}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("admin.events.delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {t("admin.events.table.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editorMode === "create" ? t("admin.events.dialog.create") : t("admin.events.dialog.edit")}</DialogTitle>
            <DialogDescription>
              Live vAMSYS payload editor for {SECTION_LABELS[editorSection]}. Use API field names from operations docs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={editorSection}
                onValueChange={(value) => {
                  const next = value as ActivitySection;
                  setEditorSection(next);
                  if (editorMode === "create") {
                    setPayloadText(JSON.stringify(buildDefaultPayload(next), null, 2));
                  }
                }}
                disabled={editorMode === "edit"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map((option) => (
                    <SelectItem key={option} value={option}>{SECTION_LABELS[option]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>JSON payload</Label>
              <Textarea
                value={payloadText}
                onChange={(event) => setPayloadText(event.target.value)}
                className="min-h-[340px] font-mono text-xs"
                placeholder='{"name":"New item"}'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isBusy} className="bg-[#E31E24] hover:bg-[#c41a20]">
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editorMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
