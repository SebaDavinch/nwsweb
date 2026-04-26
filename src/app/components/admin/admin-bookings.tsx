import { useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface BookingItem {
  id: number;
  pilotName: string;
  pilotUsername: string;
  callsign: string;
  routeLabel: string;
  aircraftLabel: string;
  departureTime: string;
  status: string;
  meta: {
    tag: string;
    priority: string;
    notes: string;
  };
}

export function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [editingBooking, setEditingBooking] = useState<BookingItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/bookings?limit=150", { credentials: "include" });
      const payload = response.ok ? await response.json() : { bookings: [] };
      setBookings(Array.isArray(payload?.bookings) ? payload.bookings : []);
    } catch (error) {
      console.error("Failed to load admin bookings", error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const statusOptions = useMemo(() => Array.from(new Set(bookings.map((item) => item.status).filter(Boolean))).sort(), [bookings]);
  const priorityOptions = useMemo(() => Array.from(new Set(bookings.map((item) => item.meta?.priority || "normal").filter(Boolean))).sort(), [bookings]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((item) => {
      const matchesSearch =
        !query ||
        [item.pilotName, item.pilotUsername, item.callsign, item.routeLabel, item.aircraftLabel]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || (item.meta?.priority || "normal") === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [bookings, priorityFilter, search, statusFilter]);

  const openDialog = (booking: BookingItem) => {
    setEditingBooking(booking);
    setTag(booking.meta?.tag || "");
    setPriority(booking.meta?.priority || "normal");
    setNotes(booking.meta?.notes || "");
    setDialogOpen(true);
  };

  const saveMeta = async () => {
    if (!editingBooking) {
      return;
    }

    await fetch(`/api/admin/bookings/${editingBooking.id}/meta`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, priority, notes }),
    });

    setDialogOpen(false);
    setEditingBooking(null);
    await loadBookings();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bookings</h2>
        <p className="text-sm text-gray-500">Review booking flow and annotate operational priorities.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search bookings..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {priorityOptions.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pilot</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Flight</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">Loading bookings...</TableCell>
                  </TableRow>
                ) : filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">No bookings found.</TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900">{booking.pilotName}</div>
                        <div className="text-xs text-gray-500">{booking.pilotUsername || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{booking.callsign}</div>
                        <div className="text-xs text-gray-500">{booking.routeLabel}</div>
                      </TableCell>
                      <TableCell>
                        <div>{booking.aircraftLabel}</div>
                        <div className="text-xs text-gray-500">{booking.departureTime || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{booking.status}</Badge>
                          <Badge variant="outline">{booking.meta?.priority || "normal"}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{booking.meta?.tag || "No tag"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => openDialog(booking)}>
                            <Pencil className="h-4 w-4" />
                            Edit
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Booking Metadata</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tag</Label>
              <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="manual-review" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea className="min-h-32" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={saveMeta}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}