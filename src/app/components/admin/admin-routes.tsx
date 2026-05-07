import { useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
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
import { useLanguage } from "../../context/language-context";

interface RouteItem {
  id: number;
  flightNumber: string;
  airlineCode: string;
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  distance: string;
  duration: string;
  fleetIds: number[];
  meta: {
    hubId: string | null;
    hubLabel: string | null;
    status: string;
    priority: string;
    notes: string;
  };
}

interface HubItem {
  id: string;
  icao: string;
  name: string;
}

export function AdminRoutesPage() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hubId, setHubId] = useState("");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [routesResponse, hubsResponse] = await Promise.all([
        fetch("/api/admin/routes", { credentials: "include" }),
        fetch("/api/admin/content/hubs", { credentials: "include" }),
      ]);

      const routesPayload = routesResponse.ok ? await routesResponse.json() : { routes: [] };
      const hubsPayload = hubsResponse.ok ? await hubsResponse.json() : { items: [] };
      setRoutes(Array.isArray(routesPayload?.routes) ? routesPayload.routes : []);
      setHubs(Array.isArray(hubsPayload?.items) ? hubsPayload.items : []);
    } catch (error) {
      console.error("Failed to load routes admin data", error);
      setRoutes([]);
      setHubs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const airlineOptions = useMemo(() => Array.from(new Set(routes.map((item) => item.airlineCode).filter(Boolean))).sort(), [routes]);
  const statusOptions = useMemo(() => Array.from(new Set(routes.map((item) => item.meta?.status || "active"))).sort(), [routes]);

  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return routes.filter((item) => {
      const matchesSearch =
        !query ||
        [item.flightNumber, item.fromCode, item.toCode, item.fromName, item.toName]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesAirline = airlineFilter === "all" || item.airlineCode === airlineFilter;
      const matchesStatus = statusFilter === "all" || (item.meta?.status || "active") === statusFilter;
      return matchesSearch && matchesAirline && matchesStatus;
    });
  }, [airlineFilter, routes, search, statusFilter]);

  const openDialog = (route: RouteItem) => {
    setEditingRoute(route);
    setHubId(route.meta?.hubId || "none");
    setStatus(route.meta?.status || "active");
    setPriority(route.meta?.priority || "normal");
    setNotes(route.meta?.notes || "");
    setDialogOpen(true);
  };

  const saveMeta = async () => {
    if (!editingRoute) {
      return;
    }

    await fetch(`/api/admin/routes/${editingRoute.id}/meta`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hubId: hubId === "none" ? "" : hubId,
        status,
        priority,
        notes,
      }),
    });

    setDialogOpen(false);
    setEditingRoute(null);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{tr("Маршруты", "Routes")}</h2>
        <p className="text-sm text-gray-500">{tr("Операционный каталог маршрутов с метаданными хабов и приоритета.", "Operational route catalog with hub and priority metadata.")}</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder={tr("Поиск маршрутов...", "Search routes...")} value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={airlineFilter} onValueChange={setAirlineFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={tr("Авиакомпания", "Airline")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Все авиакомпании", "All airlines")}</SelectItem>
                  {airlineOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={tr("Статус", "Status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Все статусы", "All statuses")}</SelectItem>
                  {statusOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Рейс", "Flight")}</TableHead>
                  <TableHead>{tr("Маршрут", "Route")}</TableHead>
                  <TableHead>{tr("Операции", "Ops")}</TableHead>
                  <TableHead>{tr("Метаданные", "Meta")}</TableHead>
                  <TableHead className="text-right">{tr("Действия", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">{tr("Загрузка маршрутов...", "Loading routes...")}</TableCell>
                  </TableRow>
                ) : filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">{tr("Маршруты не найдены.", "No routes found.")}</TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900">{route.flightNumber || "—"}</div>
                        <div className="text-xs text-gray-500">{route.airlineCode || "NWS"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{route.fromCode} → {route.toCode}</div>
                        <div className="text-xs text-gray-500">{route.fromName} → {route.toName}</div>
                      </TableCell>
                      <TableCell>
                        <div>{route.distance}</div>
                        <div className="text-xs text-gray-500">{route.duration} · {route.fleetIds?.length || 0} {tr("привязок флота", "fleet refs")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{route.meta?.status || "active"}</Badge>
                          <Badge variant="outline">{route.meta?.priority || "normal"}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{route.meta?.hubLabel || tr("Хаб не назначен", "No hub assigned")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => openDialog(route)}>
                            <Pencil className="h-4 w-4" />
                            {tr("Изменить", "Edit")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr("Изменить метаданные маршрута", "Edit Route Metadata")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tr("Хаб", "Hub")}</Label>
              <Select value={hubId} onValueChange={setHubId}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Выберите хаб", "Select hub")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr("Без хаба", "No hub")}</SelectItem>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.name} {hub.icao ? `(${hub.icao})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr("Статус", "Status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tr("Активен", "Active")}</SelectItem>
                  <SelectItem value="seasonal">{tr("Сезонный", "Seasonal")}</SelectItem>
                  <SelectItem value="paused">{tr("На паузе", "Paused")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr("Приоритет", "Priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{tr("Обычный", "Normal")}</SelectItem>
                  <SelectItem value="high">{tr("Высокий", "High")}</SelectItem>
                  <SelectItem value="critical">{tr("Критический", "Critical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{tr("Заметки", "Notes")}</Label>
              <Textarea className="min-h-32" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tr("Отмена", "Cancel")}</Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={saveMeta}>{tr("Сохранить", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}