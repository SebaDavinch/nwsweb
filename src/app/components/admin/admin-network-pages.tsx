import { useEffect, useMemo, useState } from "react";
import { Building2, Edit, PlaneTakeoff, RefreshCw, Search, Trash2, Users, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";

interface AdminActivityItem {
  id: string;
  originalId: number;
  type: string;
  subtype?: string | null;
  name: string;
  description: string;
  tags: string[];
  start?: string | null;
  end?: string | null;
  showFrom?: string | null;
  status: string;
  target: string;
  registrationCount: number;
  completionCount: number;
  points: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AdminActivitiesResponse {
  activities?: AdminActivityItem[];
  summary?: {
    total?: number;
    byType?: Record<string, number>;
    byStatus?: Record<string, number>;
  };
  error?: string;
}

interface AdminHubItem {
  id: number;
  name: string;
  order: number;
  default: boolean;
  pilotsCount: number;
  airportIds: number[];
  airportLabels: string[];
  airportsText: string;
  city?: string | null;
  countryName?: string | null;
  countryIso2?: string | null;
  updatedAt?: string | null;
}

interface AdminAirportItem {
  id: number;
  name: string;
  icao: string;
  iata: string;
  category: string;
  base: boolean;
  suitableAlternate: boolean;
  taxiInMinutes: number;
  taxiOutMinutes: number;
  airportBriefingUrl?: string | null;
  preferredAlternates: string[];
  countryName: string;
  countryIso2?: string | null;
  updatedAt?: string | null;
}

interface AirportBulkFormState {
  applyCategory: boolean;
  category: string;
  applyBase: boolean;
  base: "true" | "false";
  applySuitableAlternate: boolean;
  suitableAlternate: "true" | "false";
  applyTaxiInMinutes: boolean;
  taxiInMinutes: string;
  applyTaxiOutMinutes: boolean;
  taxiOutMinutes: string;
  applyAirportBriefingUrl: boolean;
  airportBriefingUrl: string;
  applyPreferredAlternates: boolean;
  preferredAlternates: string;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCompactDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const summarizeTags = (tags: string[]) => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return "—";
  }
  return tags.join(", ");
};

const countryFlagEmoji = (iso2?: string | null) => {
  const normalized = String(iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "";
  }

  return String.fromCodePoint(...normalized.split("").map((char) => 127397 + char.charCodeAt(0)));
};

const createAirportBulkFormState = (): AirportBulkFormState => ({
  applyCategory: false,
  category: "",
  applyBase: false,
  base: "false",
  applySuitableAlternate: false,
  suitableAlternate: "false",
  applyTaxiInMinutes: false,
  taxiInMinutes: "0",
  applyTaxiOutMinutes: false,
  taxiOutMinutes: "0",
  applyAirportBriefingUrl: false,
  airportBriefingUrl: "",
  applyPreferredAlternates: false,
  preferredAlternates: "",
});

export function AdminActivitiesManagement() {
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; byType: Record<string, number>; byStatus: Record<string, number> }>({
    total: 0,
    byType: {},
    byStatus: {},
  });
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subtypeFilter, setSubtypeFilter] = useState("all");

  const loadActivities = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/admin/activities", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as AdminActivitiesResponse | null;

      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to load activities"));
      }

      setActivities(Array.isArray(payload?.activities) ? payload.activities : []);
      setSummary({
        total: Number(payload?.summary?.total || 0) || 0,
        byType: payload?.summary?.byType && typeof payload.summary.byType === "object" ? payload.summary.byType : {},
        byStatus: payload?.summary?.byStatus && typeof payload.summary.byStatus === "object" ? payload.summary.byStatus : {},
      });
    } catch (error) {
      console.error("Failed to load admin activities", error);
      toast.error(String(error || "Failed to load activities"));
      setActivities([]);
      setSummary({ total: 0, byType: {}, byStatus: {} });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  const scopedActivities = useMemo(
    () => activeTab === "soon-starting" ? activities.filter((item) => item.status === "upcoming") : activities,
    [activeTab, activities]
  );

  const scopedSummary = useMemo(() => {
    return scopedActivities.reduce(
      (accumulator, item) => {
        accumulator.total += 1;
        accumulator.byType[item.type] = (accumulator.byType[item.type] || 0) + 1;
        accumulator.byStatus[item.status] = (accumulator.byStatus[item.status] || 0) + 1;
        return accumulator;
      },
      { total: 0, byType: {} as Record<string, number>, byStatus: {} as Record<string, number> }
    );
  }, [scopedActivities]);

  const typeOptions = useMemo(
    () => Array.from(new Set(scopedActivities.map((item) => item.type).filter(Boolean))).sort(),
    [scopedActivities]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(scopedActivities.map((item) => item.status).filter(Boolean))).sort(),
    [scopedActivities]
  );

  const subtypeOptions = useMemo(() => {
    return Array.from(
      new Set(
        scopedActivities
          .filter((item) => typeFilter === "all" || item.type === typeFilter)
          .map((item) => String(item.subtype || "").trim())
          .filter(Boolean)
      )
    ).sort();
  }, [scopedActivities, typeFilter]);

  useEffect(() => {
    if (subtypeFilter !== "all" && !subtypeOptions.includes(subtypeFilter)) {
      setSubtypeFilter("all");
    }
  }, [subtypeFilter, subtypeOptions]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedActivities.filter((activity) => {
      const matchesSearch =
        !query ||
        activity.name.toLowerCase().includes(query) ||
        activity.description.toLowerCase().includes(query) ||
        activity.type.toLowerCase().includes(query) ||
        String(activity.subtype || "").toLowerCase().includes(query) ||
        summarizeTags(activity.tags).toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || activity.type === typeFilter;
      const matchesStatus = statusFilter === "all" || activity.status === statusFilter;
      const matchesSubtype = subtypeFilter === "all" || String(activity.subtype || "") === subtypeFilter;
      return matchesSearch && matchesType && matchesSubtype && matchesStatus;
    });
  }, [scopedActivities, search, statusFilter, subtypeFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Activities</h2>
          <p className="text-sm text-gray-500">Live activity feed from vAMSYS Operations API across events, focus airports, tours, rosters and community campaigns.</p>
        </div>
        <Button variant="outline" onClick={() => loadActivities({ silent: true })} disabled={isLoading || isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Total</div><div className="mt-2 text-2xl font-semibold text-gray-900">{scopedSummary.total}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Active</div><div className="mt-2 text-2xl font-semibold text-gray-900">{scopedSummary.byStatus.active || 0}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Soon starting</div><div className="mt-2 text-2xl font-semibold text-gray-900">{summary.byStatus.upcoming || 0}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Ended</div><div className="mt-2 text-2xl font-semibold text-gray-900">{scopedSummary.byStatus.ended || 0}</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="all" className="border border-gray-200 bg-white px-4 data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">All activities ({summary.total})</TabsTrigger>
          <TabsTrigger value="soon-starting" className="border border-gray-200 bg-white px-4 data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">Soon starting ({summary.byStatus.upcoming || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="border-none shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search live activities..." className="pl-9" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {typeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={subtypeFilter} onValueChange={setSubtypeFilter}>
                  <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Event type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All event types</SelectItem>
                    {subtypeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Activity</th>
                      <th className="px-4 py-3 font-medium">Dates</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading activities...</td></tr>
                    ) : filteredActivities.length > 0 ? (
                      filteredActivities.map((activity) => (
                        <tr key={activity.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-gray-900">{activity.name}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{activity.type}</Badge>
                              {activity.subtype ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{activity.subtype}</Badge> : null}
                            </div>
                            <div className="mt-2 max-w-xl text-xs text-gray-500">{activity.description || "No description"}</div>
                            <div className="mt-1 text-xs text-gray-400">Tags: {summarizeTags(activity.tags)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 align-top">
                            <div>Created {formatCompactDate(activity.createdAt)}</div>
                            <div className="text-xs text-gray-500">Ends {formatCompactDate(activity.end)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 align-top">{activity.target}</td>
                          <td className="px-4 py-3 text-gray-700 align-top">
                            <div>{activity.registrationCount} registrations</div>
                            <div className="text-xs text-gray-500">{activity.completionCount} completions · {activity.points} pts</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{activity.status}</Badge>
                            <div className="mt-2 text-xs text-gray-500">Updated {formatDateTime(activity.updatedAt)}</div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No activities found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="soon-starting">
          <Card className="border-none shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search soon starting activities..." className="pl-9" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {typeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={subtypeFilter} onValueChange={setSubtypeFilter}>
                  <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Event type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All event types</SelectItem>
                    {subtypeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Activity</th>
                      <th className="px-4 py-3 font-medium">Dates</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading activities...</td></tr>
                    ) : filteredActivities.length > 0 ? (
                      filteredActivities.map((activity) => (
                        <tr key={activity.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-gray-900">{activity.name}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{activity.type}</Badge>
                              {activity.subtype ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{activity.subtype}</Badge> : null}
                            </div>
                            <div className="mt-2 max-w-xl text-xs text-gray-500">{activity.description || "No description"}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 align-top">
                            <div>Created {formatCompactDate(activity.createdAt)}</div>
                            <div className="text-xs text-gray-500">Ends {formatCompactDate(activity.end)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 align-top">{activity.target}</td>
                          <td className="px-4 py-3 text-gray-700 align-top">
                            <div>{activity.registrationCount} registrations</div>
                            <div className="text-xs text-gray-500">{activity.completionCount} completions · {activity.points} pts</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">soon starting</Badge>
                            <div className="mt-2 text-xs text-gray-500">Starts {formatCompactDate(activity.start)}</div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No upcoming activities found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function AdminHubsManagement() {
  const [hubs, setHubs] = useState<AdminHubItem[]>([]);
  const [airports, setAirports] = useState<AdminAirportItem[]>([]);
  const [search, setSearch] = useState("");
  const [defaultFilter, setDefaultFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<AdminHubItem | null>(null);
  const [formState, setFormState] = useState({ name: "", order: "0", default: false, airportRefs: "" });
  const [hubPilotsHub, setHubPilotsHub] = useState<AdminHubItem | null>(null);
  const [hubPilotsList, setHubPilotsList] = useState<Array<{ id: number; username: string; nameWithRank: string }>>([]);
  const [hubPilotsLoading, setHubPilotsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [hubsResponse, airportsResponse] = await Promise.all([
        fetch("/api/admin/hubs", { credentials: "include" }),
        fetch("/api/admin/airports", { credentials: "include" }),
      ]);

      const hubsPayload = hubsResponse.ok ? await hubsResponse.json() : { hubs: [] };
      const airportsPayload = airportsResponse.ok ? await airportsResponse.json() : { airports: [] };

      setHubs(Array.isArray(hubsPayload?.hubs) ? hubsPayload.hubs : []);
      setAirports(Array.isArray(airportsPayload?.airports) ? airportsPayload.airports : []);
    } catch (error) {
      console.error("Failed to load admin hubs", error);
      toast.error("Failed to load hubs");
      setHubs([]);
      setAirports([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredHubs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return hubs.filter((hub) => {
      const matchesSearch =
        !query ||
        hub.name.toLowerCase().includes(query) ||
        hub.airportsText.toLowerCase().includes(query) ||
        String(hub.id).includes(query);
      const matchesDefault =
        defaultFilter === "all" ||
        (defaultFilter === "default" && hub.default) ||
        (defaultFilter === "standard" && !hub.default);
      return matchesSearch && matchesDefault;
    });
  }, [defaultFilter, hubs, search]);

  const airportReferenceHelp = useMemo(() => airports.slice(0, 12).map((airport) => airport.icao || airport.iata).filter(Boolean).join(", "), [airports]);

  const openHubPilots = async (hub: AdminHubItem) => {
    setHubPilotsHub(hub);
    setHubPilotsList([]);
    setHubPilotsLoading(true);
    try {
      const response = await fetch(`/api/admin/hubs/${hub.id}/pilots`, { credentials: "include" });
      const data = response.ok ? await response.json().catch(() => null) : null;
      setHubPilotsList(Array.isArray(data?.pilots) ? data.pilots : []);
    } catch {
      setHubPilotsList([]);
    } finally {
      setHubPilotsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingHub(null);
    setFormState({ name: "", order: String(hubs.length + 1), default: false, airportRefs: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (hub: AdminHubItem) => {
    setEditingHub(hub);
    setFormState({
      name: hub.name,
      order: String(hub.order || 0),
      default: Boolean(hub.default),
      airportRefs: hub.airportIds.join(", "),
    });
    setIsDialogOpen(true);
  };

  const saveHub = async () => {
    const url = editingHub ? `/api/admin/hubs/${editingHub.id}` : "/api/admin/hubs";
    const method = editingHub ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          order: formState.order,
          default: formState.default,
          airportRefs: formState.airportRefs,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to save hub"));
      }
      toast.success(editingHub ? "Hub updated" : "Hub created");
      setIsDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to save hub", error);
      toast.error(String(error || "Failed to save hub"));
    }
  };

  const deleteHub = async (hub: AdminHubItem) => {
    if (hub.pilotsCount > 0) {
      toast.error(`Cannot delete hub "${hub.name}" — it has ${hub.pilotsCount} pilot(s). Reassign them first.`);
      return;
    }
    if (!window.confirm(`Delete hub ${hub.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/hubs/${hub.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to delete hub"));
      }
      toast.success("Hub deleted");
      await loadData();
    } catch (error) {
      console.error("Failed to delete hub", error);
      toast.error(String(error || "Failed to delete hub"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Hubs</h2>
          <p className="text-sm text-gray-500">Manage live vAMSYS hubs and map them to airports in your network.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Building2 className="mr-2 h-4 w-4" />
            New hub
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hubs or airport assignments..." className="pl-9" />
            </div>
            <Select value={defaultFilter} onValueChange={setDefaultFilter}>
              <SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Hub type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hubs</SelectItem>
                <SelectItem value="default">Default only</SelectItem>
                <SelectItem value="standard">Standard only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Hub</th>
                  <th className="px-4 py-3 font-medium">Airports</th>
                  <th className="px-4 py-3 font-medium">Pilots</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading hubs...</td></tr>
                ) : filteredHubs.length > 0 ? (
                  filteredHubs.map((hub) => (
                    <tr key={hub.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">{hub.name}</div>
                          {hub.default ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">default</Badge> : null}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          {hub.countryIso2 ? <img src={`https://flagcdn.com/16x12/${hub.countryIso2.toLowerCase()}.png`} srcSet={`https://flagcdn.com/32x24/${hub.countryIso2.toLowerCase()}.png 2x`} width={16} height={12} alt={hub.countryName || hub.countryIso2} className="inline-block shrink-0" /> : null}
                          {hub.city && hub.countryName ? `${hub.city}, ${hub.countryName}` : hub.countryName || hub.city || `Hub #${hub.id}`}
                          <span className="text-gray-400">·</span>
                          order {hub.order || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 align-top max-w-md whitespace-normal">{hub.airportsText || "—"}</td>
                      <td className="px-4 py-3 text-gray-700 align-top">{hub.pilotsCount}</td>
                      <td className="px-4 py-3 text-gray-500 align-top">{formatDateTime(hub.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {hub.pilotsCount > 0 ? (
                            <Button variant="outline" size="sm" onClick={() => void openHubPilots(hub)}><Users className="mr-2 h-4 w-4" />{hub.pilotsCount}</Button>
                          ) : null}
                          <Button variant="outline" size="sm" onClick={() => openEdit(hub)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                          <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteHub(hub)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hubs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={hubPilotsHub !== null} onOpenChange={(open) => { if (!open) setHubPilotsHub(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pilots in {hubPilotsHub?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {hubPilotsLoading ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading pilots...</div>
            ) : hubPilotsList.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {hubPilotsList.map((pilot) => (
                  <div key={pilot.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{pilot.nameWithRank}</div>
                      <div className="text-xs text-gray-500">{pilot.username}</div>
                    </div>
                    <span className="text-xs text-gray-400">#{pilot.id}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">No pilots in this hub.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHubPilotsHub(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingHub ? "Edit Hub" : "Create Hub"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Hub name</Label>
              <Input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} placeholder="Moscow Hub" />
            </div>
            <div className="space-y-2">
              <Label>Order</Label>
              <Input type="number" value={formState.order} onChange={(event) => setFormState((current) => ({ ...current, order: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Default hub</Label>
              <div className="flex min-h-10 items-center rounded-md border px-3">
                <Checkbox checked={formState.default} onCheckedChange={(checked) => setFormState((current) => ({ ...current, default: Boolean(checked) }))} />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Airport IDs or ICAO/IATA codes</Label>
              <Textarea value={formState.airportRefs} onChange={(event) => setFormState((current) => ({ ...current, airportRefs: event.target.value }))} className="min-h-[120px]" placeholder="UUEE, LED, 265843" />
              <p className="text-xs text-gray-500">Use comma-separated airport references. Example values: {airportReferenceHelp || "UUEE, LED, KGD"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveHub}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminAirportsManagement() {
  const [airports, setAirports] = useState<AdminAirportItem[]>([]);
  const [search, setSearch] = useState("");
  const [baseFilter, setBaseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("country-asc");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingAirport, setEditingAirport] = useState<AdminAirportItem | null>(null);
  const [selectedAirportIds, setSelectedAirportIds] = useState<number[]>([]);
  const [bulkFormState, setBulkFormState] = useState<AirportBulkFormState>(createAirportBulkFormState());
  const [formState, setFormState] = useState({
    icaoIata: "",
    name: "",
    category: "",
    base: false,
    suitableAlternate: false,
    taxiInMinutes: "0",
    taxiOutMinutes: "0",
    airportBriefingUrl: "",
    preferredAlternates: "",
  });

  const loadAirports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/airports", { credentials: "include" });
      const payload = response.ok ? await response.json() : { airports: [] };
      setAirports(Array.isArray(payload?.airports) ? payload.airports : []);
    } catch (error) {
      console.error("Failed to load airports", error);
      toast.error("Failed to load airports");
      setAirports([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAirports();
  }, []);

  const categoryOptions = useMemo(
    () => Array.from(new Set(airports.map((airport) => airport.category).filter((value) => value && value !== "—"))).sort(),
    [airports]
  );

  const countryOptions = useMemo(
    () => Array.from(new Set(airports.map((airport) => airport.countryName).filter((value) => value && value !== "—"))).sort(),
    [airports]
  );

  const filteredAirports = useMemo(() => {
    const query = search.trim().toLowerCase();
    const nextItems = airports.filter((airport) => {
      const matchesSearch =
        !query ||
        airport.name.toLowerCase().includes(query) ||
        airport.icao.toLowerCase().includes(query) ||
        airport.iata.toLowerCase().includes(query) ||
        airport.countryName.toLowerCase().includes(query) ||
        airport.category.toLowerCase().includes(query);
      const matchesBase =
        baseFilter === "all" ||
        (baseFilter === "base" && airport.base) ||
        (baseFilter === "regular" && !airport.base);
      const matchesCategory = categoryFilter === "all" || airport.category === categoryFilter;
      const matchesCountry = countryFilter === "all" || airport.countryName === countryFilter;
      return matchesSearch && matchesBase && matchesCategory && matchesCountry;
    });

    nextItems.sort((left, right) => {
      switch (sortBy) {
        case "country-desc":
          return left.countryName.localeCompare(right.countryName) * -1 || left.icao.localeCompare(right.icao);
        case "icao-asc":
          return (left.icao || left.iata || left.name).localeCompare(right.icao || right.iata || right.name);
        case "name-asc":
          return left.name.localeCompare(right.name);
        case "updated-desc": {
          const leftTime = Date.parse(String(left.updatedAt || ""));
          const rightTime = Date.parse(String(right.updatedAt || ""));
          return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
        }
        case "country-asc":
        default:
          return left.countryName.localeCompare(right.countryName) || left.icao.localeCompare(right.icao);
      }
    });

    return nextItems;
  }, [airports, baseFilter, categoryFilter, countryFilter, search, sortBy]);

  const allFilteredSelected = filteredAirports.length > 0 && filteredAirports.every((airport) => selectedAirportIds.includes(airport.id));

  const openCreate = () => {
    setEditingAirport(null);
    setFormState({
      icaoIata: "",
      name: "",
      category: "",
      base: false,
      suitableAlternate: false,
      taxiInMinutes: "0",
      taxiOutMinutes: "0",
      airportBriefingUrl: "",
      preferredAlternates: "",
    });
    setIsDialogOpen(true);
  };

  const openEdit = (airport: AdminAirportItem) => {
    setEditingAirport(airport);
    setFormState({
      icaoIata: airport.icao || airport.iata,
      name: airport.name,
      category: airport.category === "—" ? "" : airport.category,
      base: airport.base,
      suitableAlternate: airport.suitableAlternate,
      taxiInMinutes: String(airport.taxiInMinutes || 0),
      taxiOutMinutes: String(airport.taxiOutMinutes || 0),
      airportBriefingUrl: airport.airportBriefingUrl || "",
      preferredAlternates: Array.isArray(airport.preferredAlternates) ? airport.preferredAlternates.join(", ") : "",
    });
    setIsDialogOpen(true);
  };

  const saveAirport = async () => {
    const url = editingAirport ? `/api/admin/airports/${editingAirport.id}` : "/api/admin/airports";
    const method = editingAirport ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to save airport"));
      }
      toast.success(editingAirport ? "Airport updated" : "Airport added");
      setIsDialogOpen(false);
      await loadAirports();
    } catch (error) {
      console.error("Failed to save airport", error);
      toast.error(String(error || "Failed to save airport"));
    }
  };

  const deleteAirport = async (airport: AdminAirportItem) => {
    if (!window.confirm(`Delete airport ${airport.icao || airport.iata || airport.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/airports/${airport.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to delete airport"));
      }
      toast.success("Airport deleted");
      await loadAirports();
    } catch (error) {
      console.error("Failed to delete airport", error);
      toast.error(String(error || "Failed to delete airport"));
    }
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedAirportIds((current) => Array.from(new Set([...current, ...filteredAirports.map((airport) => airport.id)])));
      return;
    }

    const filteredIds = new Set(filteredAirports.map((airport) => airport.id));
    setSelectedAirportIds((current) => current.filter((airportId) => !filteredIds.has(airportId)));
  };

  const toggleAirportSelection = (airportId: number, checked: boolean) => {
    setSelectedAirportIds((current) => checked ? Array.from(new Set([...current, airportId])) : current.filter((item) => item !== airportId));
  };

  const openBulkDialog = () => {
    setBulkFormState(createAirportBulkFormState());
    setBulkDialogOpen(true);
  };

  const applyBulkAirportEdit = async () => {
    if (selectedAirportIds.length === 0) {
      toast.error("Select at least one airport");
      return;
    }

    const payload: Record<string, string | boolean> = {};
    if (bulkFormState.applyCategory) {
      payload.category = bulkFormState.category;
    }
    if (bulkFormState.applyBase) {
      payload.base = bulkFormState.base === "true";
    }
    if (bulkFormState.applySuitableAlternate) {
      payload.suitableAlternate = bulkFormState.suitableAlternate === "true";
    }
    if (bulkFormState.applyTaxiInMinutes) {
      payload.taxiInMinutes = bulkFormState.taxiInMinutes;
    }
    if (bulkFormState.applyTaxiOutMinutes) {
      payload.taxiOutMinutes = bulkFormState.taxiOutMinutes;
    }
    if (bulkFormState.applyAirportBriefingUrl) {
      payload.airportBriefingUrl = bulkFormState.airportBriefingUrl;
    }
    if (bulkFormState.applyPreferredAlternates) {
      payload.preferredAlternates = bulkFormState.preferredAlternates;
    }

    if (Object.keys(payload).length === 0) {
      toast.error("Choose at least one field for bulk edit");
      return;
    }

    const targetAirports = airports.filter((airport) => selectedAirportIds.includes(airport.id));
    const results = await Promise.allSettled(
      targetAirports.map((airport) => fetch(`/api/admin/airports/${airport.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icaoIata: airport.icao || airport.iata,
          name: airport.name,
          category: Object.prototype.hasOwnProperty.call(payload, "category") ? payload.category : airport.category,
          base: Object.prototype.hasOwnProperty.call(payload, "base") ? payload.base : airport.base,
          suitableAlternate: Object.prototype.hasOwnProperty.call(payload, "suitableAlternate") ? payload.suitableAlternate : airport.suitableAlternate,
          taxiInMinutes: Object.prototype.hasOwnProperty.call(payload, "taxiInMinutes") ? payload.taxiInMinutes : String(airport.taxiInMinutes || 0),
          taxiOutMinutes: Object.prototype.hasOwnProperty.call(payload, "taxiOutMinutes") ? payload.taxiOutMinutes : String(airport.taxiOutMinutes || 0),
          airportBriefingUrl: Object.prototype.hasOwnProperty.call(payload, "airportBriefingUrl") ? payload.airportBriefingUrl : airport.airportBriefingUrl || "",
          preferredAlternates: Object.prototype.hasOwnProperty.call(payload, "preferredAlternates") ? payload.preferredAlternates : airport.preferredAlternates.join(", "),
        }),
      }))
    );

    const failed = results.filter((item) => item.status === "rejected" || (item.status === "fulfilled" && !item.value.ok)).length;
    if (failed > 0) {
      toast.error(`Bulk update partially failed for ${failed} airports`);
    } else {
      toast.success(`Updated ${selectedAirportIds.length} airports`);
    }

    setBulkDialogOpen(false);
    await loadAirports();
  };

  const deleteSelectedAirports = async () => {
    if (selectedAirportIds.length === 0) {
      toast.error("Select at least one airport");
      return;
    }

    if (!window.confirm(`Delete ${selectedAirportIds.length} selected airports?`)) {
      return;
    }

    const results = await Promise.allSettled(
      selectedAirportIds.map((airportId) => fetch(`/api/admin/airports/${airportId}`, {
        method: "DELETE",
        credentials: "include",
      }))
    );

    const failed = results.filter((item) => item.status === "rejected" || (item.status === "fulfilled" && !item.value.ok)).length;
    if (failed > 0) {
      toast.error(`Delete partially failed for ${failed} airports`);
    } else {
      toast.success(`Deleted ${selectedAirportIds.length} airports`);
    }

    setSelectedAirportIds([]);
    await loadAirports();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Airports</h2>
          <p className="text-sm text-gray-500">Manage airline network airports from live vAMSYS data, including base flags and briefing links.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => loadAirports()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" onClick={openBulkDialog} disabled={selectedAirportIds.length === 0}><Wand2 className="mr-2 h-4 w-4" />Bulk edit</Button>
          <Button onClick={openCreate}><PlaneTakeoff className="mr-2 h-4 w-4" />Add airport</Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search airports..." className="pl-9" />
            </div>
            <Select value={baseFilter} onValueChange={setBaseFilter}>
              <SelectTrigger className="w-full xl:w-44"><SelectValue placeholder="Base filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All airports</SelectItem>
                <SelectItem value="base">Bases only</SelectItem>
                <SelectItem value="regular">Non-base only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full xl:w-52"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countryOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="country-asc">Country A-Z</SelectItem>
                <SelectItem value="country-desc">Country Z-A</SelectItem>
                <SelectItem value="icao-asc">ICAO A-Z</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="updated-desc">Recently updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedAirportIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <div className="text-sm font-medium text-red-900">{selectedAirportIds.length} airports selected</div>
              <Button variant="outline" size="sm" onClick={openBulkDialog}><Wand2 className="mr-2 h-4 w-4" />Bulk edit</Button>
              <Button variant="outline" size="sm" onClick={deleteSelectedAirports}><Trash2 className="mr-2 h-4 w-4" />Delete selected</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedAirportIds([])}><X className="mr-2 h-4 w-4" />Clear selection</Button>
            </div>
          ) : null}

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium"><Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => toggleSelectAllFiltered(Boolean(checked))} /></th>
                  <th className="px-4 py-3 font-medium">Airport</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Ops</th>
                  <th className="px-4 py-3 font-medium">Alternates</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading airports...</td></tr>
                ) : filteredAirports.length > 0 ? (
                  filteredAirports.map((airport) => (
                    <tr key={airport.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top"><Checkbox checked={selectedAirportIds.includes(airport.id)} onCheckedChange={(checked) => toggleAirportSelection(airport.id, Boolean(checked))} /></td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900">{`${countryFlagEmoji(airport.countryIso2)} ${airport.icao || airport.iata || airport.name}`.trim()}</div>
                        <div className="text-xs text-gray-500">{airport.name}</div>
                        <div className="text-xs text-gray-400">{airport.countryName}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div>{airport.category}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {airport.base ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">base</Badge> : null}
                          {airport.suitableAlternate ? <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">alternate</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div>Taxi in {airport.taxiInMinutes} min</div>
                        <div className="text-xs text-gray-500">Taxi out {airport.taxiOutMinutes} min</div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700 max-w-xs whitespace-normal">{airport.preferredAlternates.length > 0 ? airport.preferredAlternates.join(", ") : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(airport)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                          <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteAirport(airport)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No airports found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAirport ? "Edit Airport" : "Add Airport"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>ICAO/IATA</Label>
              <Input value={formState.icaoIata} onChange={(event) => setFormState((current) => ({ ...current, icaoIata: event.target.value.toUpperCase() }))} placeholder="EGLL" disabled={Boolean(editingAirport)} />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} placeholder="London Heathrow Airport" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={formState.category} onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))} placeholder="International" />
            </div>
            <div className="space-y-2">
              <Label>Briefing URL</Label>
              <Input value={formState.airportBriefingUrl} onChange={(event) => setFormState((current) => ({ ...current, airportBriefingUrl: event.target.value }))} placeholder="https://example.com/briefing/EGLL" />
            </div>
            <div className="space-y-2">
              <Label>Taxi in minutes</Label>
              <Input type="number" value={formState.taxiInMinutes} onChange={(event) => setFormState((current) => ({ ...current, taxiInMinutes: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Taxi out minutes</Label>
              <Input type="number" value={formState.taxiOutMinutes} onChange={(event) => setFormState((current) => ({ ...current, taxiOutMinutes: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Base airport</Label>
              <div className="flex min-h-10 items-center rounded-md border px-3">
                <Checkbox checked={formState.base} onCheckedChange={(checked) => setFormState((current) => ({ ...current, base: Boolean(checked) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Suitable alternate</Label>
              <div className="flex min-h-10 items-center rounded-md border px-3">
                <Checkbox checked={formState.suitableAlternate} onCheckedChange={(checked) => setFormState((current) => ({ ...current, suitableAlternate: Boolean(checked) }))} />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Preferred alternates</Label>
              <Textarea value={formState.preferredAlternates} onChange={(event) => setFormState((current) => ({ ...current, preferredAlternates: event.target.value.toUpperCase() }))} className="min-h-[100px]" placeholder="EGKK, EGLC, EGSS" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAirport}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Edit Airports</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Selected airports: {selectedAirportIds.length}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applyCategory} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyCategory: Boolean(checked) }))} /><Label>Category</Label></div>
                <Input value={bulkFormState.category} onChange={(event) => setBulkFormState((current) => ({ ...current, category: event.target.value }))} placeholder="International" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applyBase} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyBase: Boolean(checked) }))} /><Label>Base airport</Label></div>
                <Select value={bulkFormState.base} onValueChange={(value: "true" | "false") => setBulkFormState((current) => ({ ...current, base: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applySuitableAlternate} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applySuitableAlternate: Boolean(checked) }))} /><Label>Suitable alternate</Label></div>
                <Select value={bulkFormState.suitableAlternate} onValueChange={(value: "true" | "false") => setBulkFormState((current) => ({ ...current, suitableAlternate: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applyAirportBriefingUrl} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyAirportBriefingUrl: Boolean(checked) }))} /><Label>Briefing URL</Label></div>
                <Input value={bulkFormState.airportBriefingUrl} onChange={(event) => setBulkFormState((current) => ({ ...current, airportBriefingUrl: event.target.value }))} placeholder="https://example.com/briefing" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applyTaxiInMinutes} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyTaxiInMinutes: Boolean(checked) }))} /><Label>Taxi in minutes</Label></div>
                <Input type="number" value={bulkFormState.taxiInMinutes} onChange={(event) => setBulkFormState((current) => ({ ...current, taxiInMinutes: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applyTaxiOutMinutes} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyTaxiOutMinutes: Boolean(checked) }))} /><Label>Taxi out minutes</Label></div>
                <Input type="number" value={bulkFormState.taxiOutMinutes} onChange={(event) => setBulkFormState((current) => ({ ...current, taxiOutMinutes: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2"><Checkbox checked={bulkFormState.applyPreferredAlternates} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyPreferredAlternates: Boolean(checked) }))} /><Label>Preferred alternates</Label></div>
                <Textarea value={bulkFormState.preferredAlternates} onChange={(event) => setBulkFormState((current) => ({ ...current, preferredAlternates: event.target.value.toUpperCase() }))} className="min-h-[100px]" placeholder="EGKK, EGLC, EGSS" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkAirportEdit}>Apply bulk edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}