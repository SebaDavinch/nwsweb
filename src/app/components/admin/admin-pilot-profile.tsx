import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAdminNav } from "./admin-nav-context";
import { ArrowLeft, Award, Building2, Clock3, Edit, Loader2, Plane, Route, Send, ShieldCheck, Trash2, UserRound, Wifi, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

interface ProfileMetric {
  key: string;
  label: string;
  current: number;
  target: number;
  remaining: number;
  progressPercent: number;
  unit?: string | null;
}

interface BreakdownRow {
  key: string;
  count: number;
  flightTime?: {
    formatted?: string;
    seconds?: number;
  } | null;
  points?: {
    regular?: number;
    bonus?: number;
    sum?: number;
  } | null;
  distanceFlown?: number | null;
}

interface AdminPilotProfilePayload {
  profile: {
    id: number;
    username: string;
    name: string;
    email?: string | null;
    rank: string;
    rankId?: number | null;
    airlineId?: number | null;
    hours: number;
    flights: number;
    status: string;
    joinedAt?: string | null;
    preferHonoraryRank?: boolean;
    frozen?: boolean;
    banned?: boolean;
    useImperialUnits?: boolean;
    holidayAllowance?: number | null;
    underActivityGrace?: boolean;
    activityWhitelist?: boolean;
    activityType?: string | null;
    hubId?: number | null;
    locationId?: number | null;
  };
  statistics: {
    totalHours: number;
    totalFlights: number;
    totalPoints: number;
    uniqueArrivalAirports: number;
    lastPirepDate?: string | null;
    generatedAt?: string | null;
  };
  rank: {
    currentName: string;
    currentAbbreviation?: string | null;
    currentImageUrl?: string | null;
    currentLevel?: number | null;
    honorary?: boolean;
    nextRankName?: string | null;
    nextRankLevel?: number | null;
    progressPercent: number;
    metrics: ProfileMetric[];
  };
  badges: Array<{
    id: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    earnedAt?: string | null;
  }>;
  notes: PilotNote[];
  breakdown: {
    byAircraft: BreakdownRow[];
    byNetwork: BreakdownRow[];
    byRouteType: BreakdownRow[];
    byTimeOfDay: BreakdownRow[];
  };
  audit?: {
    pilot: AuditLogEntry[];
    aircraft: AuditLogEntry[];
    airport: AuditLogEntry[];
    pirep: AuditLogEntry[];
  };
  connections: {
    services: ConnectionServiceEntry[];
  };
  alerts: {
    updatedAt?: string | null;
    channels: AlertChannelEntry[];
    notificationTypes: AlertTypeEntry[];
    pilotApi?: AlertPilotApiSnapshot | null;
  };
}

interface PilotNote {
  id: number;
  note: string;
  enteredBy?: number | null;
  enteredByName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  path: string;
  method: string;
  changedKeys?: string[];
  admin?: {
    name?: string | null;
    username?: string | null;
    role?: string | null;
  } | null;
  target?: {
    type?: string | null;
    label?: string | null;
  } | null;
}

interface ConnectionServiceEntry {
  key: string;
  label: string;
  connected: boolean;
  available?: boolean;
  primary?: string | null;
  secondary?: string | null;
  connectedAt?: string | null;
  updatedAt?: string | null;
  note?: string | null;
}

interface AlertChannelEntry {
  key: string;
  label: string;
  enabled: boolean;
  available?: boolean;
  detail?: string | null;
}

interface AlertTypeEntry {
  key: string;
  label: string;
  enabled: boolean;
  forced?: boolean;
}

interface AlertPilotApiSnapshot {
  connected: boolean;
  preferredNetwork?: string | null;
  sbPreferences: string[];
  useImperialUnits: boolean;
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

const formatCompactNumber = (value?: number | null) => {
  const numeric = Number(value || 0) || 0;
  return numeric.toLocaleString();
};

const normalizeBreakdownRows = (value: unknown): BreakdownRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item && typeof item === "object" ? (item as BreakdownRow) : null;
      if (!row) {
        return null;
      }
      return {
        key: String(row.key || "Unknown").trim() || "Unknown",
        count: Number(row.count || 0) || 0,
        flightTime: row.flightTime || null,
        points: row.points || null,
        distanceFlown: Number(row.distanceFlown || 0) || 0,
      };
    })
    .filter(Boolean) as BreakdownRow[];
};

const normalizeConnectionServices = (value: unknown): ConnectionServiceEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item && typeof item === "object" ? (item as ConnectionServiceEntry) : null;
      if (!row) {
        return null;
      }

      return {
        key: String(row.key || "service").trim() || "service",
        label: String(row.label || row.key || "Service").trim() || "Service",
        connected: Boolean(row.connected),
        available: row.available == null ? true : Boolean(row.available),
        primary: String(row.primary || "").trim() || null,
        secondary: String(row.secondary || "").trim() || null,
        connectedAt: String(row.connectedAt || "").trim() || null,
        updatedAt: String(row.updatedAt || "").trim() || null,
        note: String(row.note || "").trim() || null,
      };
    })
    .filter(Boolean) as ConnectionServiceEntry[];
};

const normalizeAlertChannels = (value: unknown): AlertChannelEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item && typeof item === "object" ? (item as AlertChannelEntry) : null;
      if (!row) {
        return null;
      }

      return {
        key: String(row.key || "channel").trim() || "channel",
        label: String(row.label || row.key || "Channel").trim() || "Channel",
        enabled: Boolean(row.enabled),
        available: row.available == null ? true : Boolean(row.available),
        detail: String(row.detail || "").trim() || null,
      };
    })
    .filter(Boolean) as AlertChannelEntry[];
};

const normalizeAlertTypes = (value: unknown): AlertTypeEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item && typeof item === "object" ? (item as AlertTypeEntry) : null;
      if (!row) {
        return null;
      }

      return {
        key: String(row.key || "type").trim() || "type",
        label: String(row.label || row.key || "Type").trim() || "Type",
        enabled: Boolean(row.enabled),
        forced: Boolean(row.forced),
      };
    })
    .filter(Boolean) as AlertTypeEntry[];
};

const normalizePayload = (value: unknown): AdminPilotProfilePayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<AdminPilotProfilePayload>;
  if (!payload.profile) {
    return null;
  }

  return {
    profile: {
      id: Number(payload.profile.id || 0) || 0,
      username: String(payload.profile.username || "").trim(),
      name: String(payload.profile.name || payload.profile.username || "Pilot").trim() || "Pilot",
      email: String(payload.profile.email || "").trim() || null,
      rank: String(payload.profile.rank || "Member").trim() || "Member",
      rankId: Number(payload.profile.rankId || 0) || null,
      airlineId: Number(payload.profile.airlineId || 0) || null,
      hours: Number(payload.profile.hours || 0) || 0,
      flights: Number(payload.profile.flights || 0) || 0,
      status: String(payload.profile.status || "active").trim() || "active",
      joinedAt: String(payload.profile.joinedAt || "").trim() || null,
      preferHonoraryRank: Boolean(payload.profile.preferHonoraryRank),
      frozen: Boolean(payload.profile.frozen),
      banned: Boolean(payload.profile.banned),
      useImperialUnits: Boolean(payload.profile.useImperialUnits),
      holidayAllowance: payload.profile.holidayAllowance == null ? null : Number(payload.profile.holidayAllowance) || 0,
      underActivityGrace: Boolean(payload.profile.underActivityGrace),
      activityWhitelist: Boolean(payload.profile.activityWhitelist),
      activityType: String(payload.profile.activityType || "standard").trim() || "standard",
      hubId: Number(payload.profile.hubId || 0) || null,
      locationId: Number(payload.profile.locationId || 0) || null,
    },
    statistics: {
      totalHours: Number(payload.statistics?.totalHours || 0) || 0,
      totalFlights: Number(payload.statistics?.totalFlights || 0) || 0,
      totalPoints: Number(payload.statistics?.totalPoints || 0) || 0,
      uniqueArrivalAirports: Number(payload.statistics?.uniqueArrivalAirports || 0) || 0,
      lastPirepDate: String(payload.statistics?.lastPirepDate || "").trim() || null,
      generatedAt: String(payload.statistics?.generatedAt || "").trim() || null,
    },
    rank: {
      currentName: String(payload.rank?.currentName || payload.profile.rank || "Member").trim() || "Member",
      currentAbbreviation: String(payload.rank?.currentAbbreviation || "").trim() || null,
      currentImageUrl: String(payload.rank?.currentImageUrl || "").trim() || null,
      currentLevel: Number(payload.rank?.currentLevel || 0) || null,
      honorary: Boolean(payload.rank?.honorary),
      nextRankName: String(payload.rank?.nextRankName || "").trim() || null,
      nextRankLevel: Number(payload.rank?.nextRankLevel || 0) || null,
      progressPercent: Number(payload.rank?.progressPercent || 0) || 0,
      metrics: Array.isArray(payload.rank?.metrics) ? payload.rank.metrics.map((metric) => ({
        key: String(metric.key || "metric"),
        label: String(metric.label || metric.key || "Metric"),
        current: Number(metric.current || 0) || 0,
        target: Number(metric.target || 0) || 0,
        remaining: Number(metric.remaining || 0) || 0,
        progressPercent: Number(metric.progressPercent || 0) || 0,
        unit: String(metric.unit || "").trim() || null,
      })) : [],
    },
    badges: Array.isArray(payload.badges) ? payload.badges.map((badge) => ({
      id: Number(badge.id || 0) || 0,
      name: String(badge.name || "Badge").trim() || "Badge",
      description: String(badge.description || "").trim() || null,
      imageUrl: String(badge.imageUrl || "").trim() || null,
      earnedAt: String(badge.earnedAt || "").trim() || null,
    })).filter((badge) => badge.id > 0) : [],
    notes: Array.isArray((payload as { notes?: PilotNote[] }).notes)
      ? ((payload as { notes?: PilotNote[] }).notes || []).map((note) => ({
          id: Number(note.id || 0) || 0,
          note: String(note.note || "").trim(),
          enteredBy: Number(note.enteredBy || 0) || null,
          enteredByName: String(note.enteredByName || "").trim() || null,
          createdAt: String(note.createdAt || "").trim() || null,
          updatedAt: String(note.updatedAt || "").trim() || null,
        })).filter((note) => note.id > 0)
      : [],
    breakdown: {
      byAircraft: normalizeBreakdownRows(payload.breakdown?.byAircraft),
      byNetwork: normalizeBreakdownRows(payload.breakdown?.byNetwork),
      byRouteType: normalizeBreakdownRows(payload.breakdown?.byRouteType),
      byTimeOfDay: normalizeBreakdownRows(payload.breakdown?.byTimeOfDay),
    },
    audit: {
      pilot: Array.isArray(payload.audit?.pilot) ? payload.audit.pilot as AuditLogEntry[] : [],
      aircraft: Array.isArray(payload.audit?.aircraft) ? payload.audit.aircraft as AuditLogEntry[] : [],
      airport: Array.isArray(payload.audit?.airport) ? payload.audit.airport as AuditLogEntry[] : [],
      pirep: Array.isArray(payload.audit?.pirep) ? payload.audit.pirep as AuditLogEntry[] : [],
    },
    connections: {
      services: normalizeConnectionServices((payload as { connections?: { services?: ConnectionServiceEntry[] } }).connections?.services),
    },
    alerts: {
      updatedAt: String((payload as { alerts?: { updatedAt?: string | null } }).alerts?.updatedAt || "").trim() || null,
      channels: normalizeAlertChannels((payload as { alerts?: { channels?: AlertChannelEntry[] } }).alerts?.channels),
      notificationTypes: normalizeAlertTypes((payload as { alerts?: { notificationTypes?: AlertTypeEntry[] } }).alerts?.notificationTypes),
      pilotApi: (payload as { alerts?: { pilotApi?: AlertPilotApiSnapshot | null } }).alerts?.pilotApi
        ? {
            connected: Boolean((payload as { alerts?: { pilotApi?: AlertPilotApiSnapshot | null } }).alerts?.pilotApi?.connected),
            preferredNetwork: String((payload as { alerts?: { pilotApi?: AlertPilotApiSnapshot | null } }).alerts?.pilotApi?.preferredNetwork || "").trim() || null,
            sbPreferences: Array.isArray((payload as { alerts?: { pilotApi?: AlertPilotApiSnapshot | null } }).alerts?.pilotApi?.sbPreferences)
              ? ((payload as { alerts?: { pilotApi?: AlertPilotApiSnapshot | null } }).alerts?.pilotApi?.sbPreferences || [])
                  .map((item) => String(item || "").trim())
                  .filter(Boolean)
              : [],
            useImperialUnits: Boolean((payload as { alerts?: { pilotApi?: AlertPilotApiSnapshot | null } }).alerts?.pilotApi?.useImperialUnits),
          }
        : null,
    },
  };
};

const AuditTrailList = ({ rows }: { rows: AuditLogEntry[] }) => {
  return (
    rows.length > 0 ? (
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-900">{row.action}</span>
              <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{row.method}</Badge>
            </div>
            <div className="mt-1 text-gray-600">{row.target?.label || row.path}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{formatDateTime(row.createdAt)}</span>
              <span>•</span>
              <span>{row.admin?.name || row.admin?.username || "Admin"}</span>
              {Array.isArray(row.changedKeys) && row.changedKeys.length > 0 ? (
                <>
                  <span>•</span>
                  <span>{row.changedKeys.slice(0, 4).join(", ")}</span>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        No audit lines recorded for this category yet.
      </div>
    )
  );
};

const BreakdownCard = ({
  title,
  description,
  icon: Icon,
  rows,
  color,
}: {
  title: string;
  description: string;
  icon: typeof Plane;
  rows: BreakdownRow[];
  color: string;
}) => {
  const chartData = rows.slice(0, 6).map((row) => ({
    name: row.key,
    count: row.count,
  }));

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-gray-900">
          <Icon className="h-4 w-4" style={{ color }} />
          {title}
        </CardTitle>
        <p className="text-sm text-gray-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            No flights in this breakdown yet.
          </div>
        )}

        <div className="space-y-2">
          {rows.slice(0, 5).map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{row.key}</div>
                <div className="text-xs text-gray-500">{row.flightTime?.formatted || "—"} · {formatCompactNumber(row.distanceFlown)} nm</div>
              </div>
              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{formatCompactNumber(row.count)}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function AdminPilotProfile() {
  const { navigateTo } = useAdminNav();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const pilotId = Number(params.id || searchParams.get("id") || 0) || 0;
  const [payload, setPayload] = useState<AdminPilotProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingNoteId, setIsDeletingNoteId] = useState<number | null>(null);
  const [isSendingReview, setIsSendingReview] = useState(false);
  const [hubs, setHubs] = useState<Array<{ id: number; name: string }>>([]);
  const [isChangingHub, setIsChangingHub] = useState(false);

  const loadProfile = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/admin/pilots/${pilotId}/profile-page`, {
        credentials: "include",
      });
      const nextPayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(nextPayload?.error || "Failed to load admin pilot profile"));
      }
      setPayload(normalizePayload(nextPayload));
    } catch (nextError) {
      setPayload(null);
      setError(String(nextError instanceof Error ? nextError.message : "Failed to load admin pilot profile"));
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (pilotId <= 0) {
      setPayload(null);
      setError("Invalid pilot ID.");
      setIsLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const [profileResponse, hubsResponse] = await Promise.all([
          fetch(`/api/admin/pilots/${pilotId}/profile-page`, { credentials: "include" }),
          fetch("/api/admin/hubs", { credentials: "include" }),
        ]);
        const nextPayload = await profileResponse.json().catch(() => null);
        if (!profileResponse.ok) {
          throw new Error(String(nextPayload?.error || "Failed to load admin pilot profile"));
        }
        const hubsPayload = hubsResponse.ok ? await hubsResponse.json().catch(() => null) : null;
        if (active) {
          setPayload(normalizePayload(nextPayload));
          setHubs(
            (Array.isArray(hubsPayload?.hubs) ? hubsPayload.hubs : [])
              .map((h: { id: number; name: string }) => ({ id: Number(h.id || 0), name: String(h.name || "") }))
              .filter((h: { id: number; name: string }) => h.id > 0)
          );
        }
      } catch (nextError) {
        if (active) {
          setPayload(null);
          setError(String(nextError instanceof Error ? nextError.message : "Failed to load admin pilot profile"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [pilotId]);

  const handleCreateNote = async () => {
    const note = newNoteText.trim();
    if (!note) {
      return;
    }

    setIsSavingNote(true);
    try {
      const response = await fetch(`/api/admin/pilots/${pilotId}/notes`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(responsePayload?.error || "Failed to create pilot note"));
      }
      setNewNoteText("");
      await loadProfile({ silent: true });
    } catch (nextError) {
      setError(String(nextError instanceof Error ? nextError.message : "Failed to create pilot note"));
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleUpdateNote = async () => {
    const noteId = Number(editingNoteId || 0) || 0;
    const note = editingNoteText.trim();
    if (noteId <= 0 || !note) {
      return;
    }

    setIsSavingNote(true);
    try {
      const response = await fetch(`/api/admin/pilots/${pilotId}/notes/${noteId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(responsePayload?.error || "Failed to update pilot note"));
      }
      setEditingNoteId(null);
      setEditingNoteText("");
      await loadProfile({ silent: true });
    } catch (nextError) {
      setError(String(nextError instanceof Error ? nextError.message : "Failed to update pilot note"));
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm("Delete this pilot note?")) {
      return;
    }

    setIsDeletingNoteId(noteId);
    try {
      const response = await fetch(`/api/admin/pilots/${pilotId}/notes/${noteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const responsePayload = await response.json().catch(() => null);
        throw new Error(String(responsePayload?.error || "Failed to delete pilot note"));
      }
      await loadProfile({ silent: true });
    } catch (nextError) {
      setError(String(nextError instanceof Error ? nextError.message : "Failed to delete pilot note"));
    } finally {
      setIsDeletingNoteId(null);
    }
  };

  const handleAssignToHub = async (hubId: number) => {
    setIsChangingHub(true);
    try {
      const response = await fetch(`/api/admin/hubs/${hubId}/pilots/${pilotId}`, {
        method: "POST",
        credentials: "include",
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(responsePayload?.error || "Failed to assign pilot to hub"));
      }
      toast.success(responsePayload?.message || "Pilot assigned to hub.");
      await loadProfile({ silent: true });
    } catch (nextError) {
      toast.error(String(nextError instanceof Error ? nextError.message : "Failed to assign pilot to hub"));
    } finally {
      setIsChangingHub(false);
    }
  };

  const handleRemoveFromHub = async (hubId: number) => {
    setIsChangingHub(true);
    try {
      const response = await fetch(`/api/admin/hubs/${hubId}/pilots/${pilotId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(responsePayload?.error || "Failed to remove pilot from hub"));
      }
      toast.success(responsePayload?.message || "Pilot removed from hub.");
      await loadProfile({ silent: true });
    } catch (nextError) {
      toast.error(String(nextError instanceof Error ? nextError.message : "Failed to remove pilot from hub"));
    } finally {
      setIsChangingHub(false);
    }
  };

  const handleSendNameForReview = async () => {
    const reason = reviewReason.trim();
    if (!reason) {
      return;
    }

    setIsSendingReview(true);
    try {
      const response = await fetch(`/api/admin/pilots/${pilotId}/send-name-for-review`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const responsePayload = await response.json().catch(() => null);
        throw new Error(String(responsePayload?.error || "Failed to send name for review"));
      }
      setReviewReason("");
    } catch (nextError) {
      setError(String(nextError instanceof Error ? nextError.message : "Failed to send name for review"));
    } finally {
      setIsSendingReview(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!payload) {
      return [];
    }

    return [
      { label: "Total hours", value: formatCompactNumber(payload.statistics.totalHours), icon: Clock3 },
      { label: "Total flights", value: formatCompactNumber(payload.statistics.totalFlights), icon: Plane },
      { label: "Total points", value: formatCompactNumber(payload.statistics.totalPoints), icon: Award },
      { label: "Earned badges", value: formatCompactNumber(payload.badges.length), icon: ShieldCheck },
    ];
  }, [payload]);

  const auditSections = useMemo(() => {
    if (!payload) {
      return [];
    }

    return [
      { key: "pilot", title: "Pilot edits", rows: payload.audit?.pilot || [] },
      { key: "aircraft", title: "Aircraft edits", rows: payload.audit?.aircraft || [] },
      { key: "airport", title: "Airport edits", rows: payload.audit?.airport || [] },
      { key: "pirep", title: "PIREP edits", rows: payload.audit?.pirep || [] },
    ];
  }, [payload]);

  const connectedServiceCount = useMemo(
    () => payload?.connections.services.filter((service) => service.connected).length || 0,
    [payload]
  );

  const enabledAlertCount = useMemo(
    () => payload?.alerts.notificationTypes.filter((type) => type.enabled).length || 0,
    [payload]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading admin pilot profile...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigateTo("pilots")}> 
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to pilots
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "Pilot profile is unavailable."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Button variant="outline" onClick={() => navigateTo("pilots")} className="mb-3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to pilots
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{payload.profile.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{payload.profile.username} · VA ID {payload.profile.id} · admin profile view</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{payload.profile.rank}</Badge>
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{payload.profile.status}</Badge>
          {payload.rank.honorary ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Honorary display rank</Badge> : null}
          {payload.profile.useImperialUnits ? <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">Imperial units</Badge> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4 text-sm text-gray-500">
                <span>{card.label}</span>
                <card.icon className="h-4 w-4 text-[#E31E24]" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-gray-900">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-[#E31E24]" /> Hub assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-72">
              <Select
                value={payload.profile.hubId ? String(payload.profile.hubId) : "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    if (payload.profile.hubId) {
                      void handleRemoveFromHub(payload.profile.hubId);
                    }
                  } else {
                    const newHubId = Number(value);
                    if (newHubId !== payload.profile.hubId) {
                      void handleAssignToHub(newHubId);
                    }
                  }
                }}
                disabled={isChangingHub}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No hub assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No hub —</SelectItem>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={String(hub.id)}>{hub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payload.profile.hubId ? (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={isChangingHub}
                onClick={() => { if (payload.profile.hubId) void handleRemoveFromHub(payload.profile.hubId); }}
              >
                {isChangingHub ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Remove from hub
              </Button>
            ) : null}
            {isChangingHub ? <span className="text-sm text-gray-500">Updating...</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-[#E31E24]" /> Connected services and alert snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="connections">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">Connected services</div>
                  <div className="text-xs text-gray-500">{connectedServiceCount} linked of {payload.connections.services.length} tracked integrations</div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {payload.connections.services.map((service) => (
                    <div key={service.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{service.label}</div>
                          <div className="mt-1 text-sm text-gray-600">{service.primary || service.secondary || "No connection data yet."}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={service.connected
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : service.available
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-gray-200 bg-white text-gray-700"}
                        >
                          {service.connected ? "Linked" : service.available ? "Not linked" : "Pending"}
                        </Badge>
                      </div>
                      {service.primary && service.secondary ? (
                        <div className="mt-2 text-sm text-gray-500">{service.secondary}</div>
                      ) : null}
                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        {service.connectedAt ? <div>Connected {formatDateTime(service.connectedAt)}</div> : null}
                        {service.updatedAt ? <div>Updated {formatDateTime(service.updatedAt)}</div> : null}
                        {service.note ? <div>{service.note}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="alerts">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">Selected alerts</div>
                  <div className="text-xs text-gray-500">{enabledAlertCount} alert types enabled · updated {formatDateTime(payload.alerts.updatedAt)}</div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-gray-900">Delivery channels</div>
                    {payload.alerts.channels.map((channel) => (
                      <div key={channel.key} className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div>
                          <div className="font-medium text-gray-900">{channel.label}</div>
                          <div className="mt-1 text-sm text-gray-500">{channel.detail || "No additional details."}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={channel.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : channel.available
                              ? "border-gray-200 bg-white text-gray-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"}
                        >
                          {channel.enabled ? "On" : channel.available ? "Off" : "Unavailable"}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Alert types</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {payload.alerts.notificationTypes.map((type) => (
                          <Badge
                            key={type.key}
                            variant="outline"
                            className={type.enabled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-white text-gray-700"}
                          >
                            {type.label}{type.forced ? " (forced)" : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {payload.alerts.pilotApi?.connected ? (
                      <div className="rounded-xl border border-gray-100 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-900">Pilot API preferences</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm text-gray-600">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Network</div>
                            <div className="mt-1 text-gray-900">{payload.alerts.pilotApi.preferredNetwork || "offline"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">SimBrief</div>
                            <div className="mt-1 text-gray-900">{payload.alerts.pilotApi.sbPreferences.length > 0 ? payload.alerts.pilotApi.sbPreferences.join(", ") : "Not set"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Units</div>
                            <div className="mt-1 text-gray-900">{payload.alerts.pilotApi.useImperialUnits ? "Imperial" : "Metric"}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><UserRound className="h-5 w-5 text-[#E31E24]" /> Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm text-gray-600">
            <div><div className="text-xs uppercase tracking-wide text-gray-400">Email</div><div className="mt-1 text-gray-900">{payload.profile.email || "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-400">Joined</div><div className="mt-1 text-gray-900">{formatDateTime(payload.profile.joinedAt)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-400">Activity type</div><div className="mt-1 text-gray-900">{payload.profile.activityType || "standard"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-400">Holiday allowance</div><div className="mt-1 text-gray-900">{payload.profile.holidayAllowance == null ? "Disabled" : payload.profile.holidayAllowance}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-400">Unique arrivals</div><div className="mt-1 text-gray-900">{formatCompactNumber(payload.statistics.uniqueArrivalAirports)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-400">Last PIREP</div><div className="mt-1 text-gray-900">{formatDateTime(payload.statistics.lastPirepDate)}</div></div>
            <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
              {payload.profile.frozen ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Frozen</Badge> : null}
              {payload.profile.banned ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Banned</Badge> : null}
              {payload.profile.underActivityGrace ? <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Activity grace</Badge> : null}
              {payload.profile.activityWhitelist ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Activity whitelist</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Award className="h-5 w-5 text-[#E31E24]" /> Rank</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Current rank</div>
                  <div className="mt-1 text-xl font-semibold text-gray-900">{payload.rank.currentName}</div>
                  {payload.rank.currentAbbreviation ? <div className="text-sm text-gray-500">{payload.rank.currentAbbreviation}</div> : null}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Next rank</div>
                  <div className="mt-1 text-base font-medium text-gray-900">{payload.rank.nextRankName || "Top rank"}</div>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-[#E31E24]" style={{ width: `${Math.max(0, Math.min(100, payload.rank.progressPercent || 0))}%` }} />
              </div>
              <div className="mt-2 text-xs text-gray-500">Progress to next rank: {payload.rank.progressPercent}%</div>
            </div>

            <div className="space-y-3">
              {payload.rank.metrics.length > 0 ? payload.rank.metrics.map((metric) => (
                <div key={metric.key}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-900">{metric.label}</span>
                    <span className="text-gray-500">{formatCompactNumber(metric.current)} / {formatCompactNumber(metric.target)} {metric.unit || ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-[#111827]" style={{ width: `${Math.max(0, Math.min(100, metric.progressPercent || 0))}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">Remaining: {formatCompactNumber(metric.remaining)} {metric.unit || ""}</div>
                </div>
              )) : <div className="text-sm text-gray-500">No rank requirement data is available for this pilot.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Edit className="h-5 w-5 text-[#E31E24]" /> Pilot notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <Label htmlFor="pilot-note-create">Add note</Label>
              <Textarea
                id="pilot-note-create"
                value={newNoteText}
                onChange={(event) => setNewNoteText(event.target.value)}
                placeholder="Internal pilot note, markdown supported by vAMSYS"
                className="min-h-[110px] bg-white"
              />
              <div className="flex justify-end">
                <Button className="bg-[#E31E24] hover:bg-[#c21920] text-white" onClick={handleCreateNote} disabled={isSavingNote || !newNoteText.trim()}>
                  {isSavingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add note
                </Button>
              </div>
            </div>

            {payload.notes.length > 0 ? (
              <div className="space-y-3">
                {payload.notes.map((note) => {
                  const isEditing = editingNoteId === note.id;
                  return (
                    <div key={note.id} className="rounded-xl border border-gray-100 bg-white p-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <Textarea value={editingNoteText} onChange={(event) => setEditingNoteText(event.target.value)} className="min-h-[110px]" />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }} disabled={isSavingNote}>Cancel</Button>
                            <Button className="bg-[#E31E24] hover:bg-[#c21920] text-white" onClick={handleUpdateNote} disabled={isSavingNote || !editingNoteText.trim()}>
                              {isSavingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Save note
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="whitespace-pre-wrap text-sm text-gray-800">{note.note}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>{note.enteredByName || "Admin"}</span>
                            <span>•</span>
                            <span>{formatDateTime(note.createdAt)}</span>
                            {note.updatedAt && note.updatedAt !== note.createdAt ? (
                              <>
                                <span>•</span>
                                <span>Updated {formatDateTime(note.updatedAt)}</span>
                              </>
                            ) : null}
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.note); }}>
                              <Edit className="mr-2 h-4 w-4" />Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void handleDeleteNote(note.id)} disabled={isDeletingNoteId === note.id}>
                              {isDeletingNoteId === note.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                No pilot notes yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Send className="h-5 w-5 text-[#E31E24]" /> Name review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              Use this only when the pilot name needs vAMSYS staff review for naming policy issues.
            </div>
            <div className="space-y-2">
              <Label htmlFor="name-review-reason">Reason</Label>
              <Textarea
                id="name-review-reason"
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
                placeholder="Brief reason for sending this pilot name to review"
                className="min-h-[140px]"
              />
            </div>
            <div className="flex justify-end">
              <Button className="bg-[#E31E24] hover:bg-[#c21920] text-white" onClick={handleSendNameForReview} disabled={isSendingReview || !reviewReason.trim()}>
                {isSendingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send for review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-[#E31E24]" /> Earned badges</CardTitle>
        </CardHeader>
        <CardContent>
          {payload.badges.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {payload.badges.map((badge) => (
                <div key={badge.id} className="rounded-xl border border-gray-100 bg-white p-4">
                  {badge.imageUrl ? <img src={badge.imageUrl} alt={badge.name} className="mb-3 h-16 w-16 rounded-lg object-cover" /> : <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-gray-400"><Award className="h-6 w-6" /></div>}
                  <div className="font-semibold text-gray-900">{badge.name}</div>
                  <div className="mt-1 text-sm text-gray-500">{badge.description || "No description."}</div>
                  <div className="mt-3 text-xs text-gray-400">Earned {formatDateTime(badge.earnedAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              This pilot has no earned badges yet.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard title="By aircraft" description="Accepted and completed PIREPs grouped by aircraft." icon={Plane} rows={payload.breakdown.byAircraft} color="#E31E24" />
        <BreakdownCard title="By network" description="Usage split by online network or offline flying." icon={Wifi} rows={payload.breakdown.byNetwork} color="#2563eb" />
        <BreakdownCard title="By route type" description="Operational mix across scheduled, manual or other route types." icon={Route} rows={payload.breakdown.byRouteType} color="#16a34a" />
        <BreakdownCard title="By time of day" description="Day versus night activity from accepted flights." icon={Clock3} rows={payload.breakdown.byTimeOfDay} color="#7c3aed" />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Wifi className="h-5 w-5 text-[#E31E24]" /> Audit and activity logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {auditSections.map((section) => (
              <AccordionItem key={section.key} value={section.key}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="text-left">
                    <div className="text-sm font-semibold text-gray-900">{section.title}</div>
                    <div className="text-xs text-gray-500">{section.rows.length} recent log entries</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <AuditTrailList rows={section.rows} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}