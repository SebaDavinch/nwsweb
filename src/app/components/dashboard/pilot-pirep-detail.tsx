import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Clock, Gauge, MapPin, Plane, Radio, Star, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { Textarea } from "../ui/textarea";
import { LiveMap } from "../live-map";

interface TelemetryPoint {
  lat: number;
  lon: number;
  altitude?: number | null;
  heading?: number | null;
  ts?: number | null;
}

interface FlightProfilePoint {
  x: number;
  y: number;
}

interface FlightProfileAnnotation {
  id: number;
  x: number;
  label: string;
  category?: string | null;
  color?: string | null;
  num?: number | null;
}

interface FlightProfile {
  altitude?: FlightProfilePoint[];
  groundspeed?: FlightProfilePoint[];
  annotations?: FlightProfileAnnotation[];
}

interface PirepDetail {
  id: number;
  bookingId?: number | null;
  routeId?: number | null;
  aircraftId?: number | null;
  flightNumber: string;
  callsign?: string | null;
  pilot?: string | null;
  pilotId?: number | null;
  departure: string;
  departureName?: string | null;
  departureLat?: number | null;
  departureLon?: number | null;
  arrival: string;
  arrivalName?: string | null;
  arrivalLat?: number | null;
  arrivalLon?: number | null;
  aircraft: string;
  aircraftModel?: string | null;
  aircraftRegistration?: string | null;
  flightTime?: string | null;
  blockTime?: string | null;
  distance?: string | null;
  distanceNm?: number | null;
  landing?: string | null;
  landingRate?: number | null;
  status?: string | null;
  network?: string | null;
  score?: number | null;
  points?: number | null;
  comments?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  vac: "NWS" | "KAR" | "STW";
  progress?: number | null;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  currentLat?: number | null;
  currentLon?: number | null;
  hasLiveTelemetry?: boolean;
  telemetryTrack?: TelemetryPoint[];
  flightProfile?: FlightProfile | null;
}

interface PilotPirepDetailProps {
  pirepId: number | null;
  onBack: () => void;
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

const formatElapsedTime = (secondsValue: number) => {
  const totalSeconds = Math.max(0, Math.round(Number(secondsValue) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatCompactMetric = (value: number, unit: string) => {
  const numeric = Math.round(Number(value) || 0);
  return `${numeric.toLocaleString()} ${unit}`;
};

export function PilotPirepDetail({ pirepId, onBack }: PilotPirepDetailProps) {
  const [detail, setDetail] = useState<PirepDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!pirepId || pirepId <= 0) {
      setDetail(null);
      return;
    }

    let active = true;
    const loadDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/pilot/pireps/${pirepId}`, { credentials: "include" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(String(payload?.error || "Failed to load PIREP detail"));
        }
        if (active) {
          setDetail(payload?.pirep && typeof payload.pirep === "object" ? payload.pirep : null);
        }
      } catch (nextError) {
        if (active) {
          setError(String(nextError || "Failed to load PIREP detail"));
          setDetail(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [pirepId]);

  const selectedFlight = useMemo(() => {
    if (!detail) {
      return null;
    }

    return {
      id: detail.id,
      flightNumber: detail.callsign || detail.flightNumber,
      departure: detail.departure,
      departureCity: detail.departureName || detail.departure,
      destination: detail.arrival,
      destinationCity: detail.arrivalName || detail.arrival,
      status: detail.status || "Completed",
      pilot: detail.pilot || "Pilot",
      pilotId: detail.pilotId || null,
      aircraft: detail.aircraft,
      progress: Number.isFinite(Number(detail.progress)) ? Number(detail.progress) : 100,
      vac: detail.vac,
      etd: detail.departureTime || undefined,
      ete: detail.flightTime || undefined,
      eta: detail.arrivalTime || detail.completedAt || undefined,
      heading: detail.heading ?? null,
      speed: detail.speed ?? null,
      altitude: detail.altitude ?? null,
      currentLat: detail.currentLat ?? null,
      currentLon: detail.currentLon ?? null,
      aircraftRegistration: detail.aircraftRegistration || undefined,
      network: detail.network || undefined,
      hasLiveTelemetry: Boolean(detail.hasLiveTelemetry),
      telemetryTrack: Array.isArray(detail.telemetryTrack) ? detail.telemetryTrack : [],
      departureLat: detail.departureLat ?? null,
      departureLon: detail.departureLon ?? null,
      arrivalLat: detail.arrivalLat ?? null,
      arrivalLon: detail.arrivalLon ?? null,
    };
  }, [detail]);

  const flightProfileData = useMemo(() => {
    const profile = detail?.flightProfile;
    const altitudeSeries = Array.isArray(profile?.altitude) ? profile.altitude : [];
    const groundspeedSeries = Array.isArray(profile?.groundspeed) ? profile.groundspeed : [];
    const annotations = Array.isArray(profile?.annotations) ? profile.annotations : [];

    const rawPoints = [...altitudeSeries, ...groundspeedSeries]
      .map((point) => Number(point?.x || 0))
      .filter((value) => Number.isFinite(value));
    const maxRawX = rawPoints.length ? Math.max(...rawPoints) : 0;
    const usesMilliseconds = maxRawX > 172800;
    const normalizeX = (value: number) => (usesMilliseconds ? value / 1000 : value);

    const chartMap = new Map<number, { elapsed: number; altitude: number | null; groundspeed: number | null }>();
    altitudeSeries.forEach((point) => {
      const elapsed = normalizeX(Number(point.x || 0));
      if (!Number.isFinite(elapsed)) {
        return;
      }
      const existing = chartMap.get(elapsed) || { elapsed, altitude: null, groundspeed: null };
      existing.altitude = Number.isFinite(Number(point.y)) ? Number(point.y) : null;
      chartMap.set(elapsed, existing);
    });
    groundspeedSeries.forEach((point) => {
      const elapsed = normalizeX(Number(point.x || 0));
      if (!Number.isFinite(elapsed)) {
        return;
      }
      const existing = chartMap.get(elapsed) || { elapsed, altitude: null, groundspeed: null };
      existing.groundspeed = Number.isFinite(Number(point.y)) ? Number(point.y) : null;
      chartMap.set(elapsed, existing);
    });

    const chartData = Array.from(chartMap.values()).sort((left, right) => left.elapsed - right.elapsed);
    const normalizedAnnotations = annotations
      .map((annotation) => ({
        ...annotation,
        x: normalizeX(Number(annotation?.x || 0)),
      }))
      .filter((annotation) => Number.isFinite(annotation.x))
      .sort((left, right) => left.x - right.x);

    return {
      chartData,
      annotations: normalizedAnnotations,
      hasData: chartData.some((item) => item.altitude !== null || item.groundspeed !== null),
    };
  }, [detail]);

  const chartConfig = {
    altitude: {
      label: "Altitude",
      color: "#E31E24",
    },
    groundspeed: {
      label: "Ground speed",
      color: "#2563eb",
    },
  } as const;

  const handleSubmitComment = async () => {
    if (!pirepId || pirepId <= 0 || isSubmittingComment) {
      return;
    }

    const content = commentDraft.trim();
    if (!content) {
      setCommentError("Enter a comment before sending.");
      setCommentSuccess(null);
      return;
    }

    setIsSubmittingComment(true);
    setCommentError(null);
    setCommentSuccess(null);
    try {
      const response = await fetch(`/api/pilot/pireps/${pirepId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to submit comment"));
      }

      const submittedText = String(payload?.comment?.content || content).trim();
      setDetail((previous) => {
        if (!previous) {
          return previous;
        }
        const previousComments = String(previous.comments || "").trim();
        const nextComments = previousComments ? `${previousComments}\n\n${submittedText}` : submittedText;
        return {
          ...previous,
          comments: nextComments,
        };
      });
      setCommentDraft("");
      setCommentSuccess("Comment sent successfully.");
    } catch (submitError) {
      setCommentError(String(submitError instanceof Error ? submitError.message : "Failed to submit comment"));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!pirepId) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to recent flights
        </Button>
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">Choose a PIREP to inspect route telemetry and flight details.</div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 text-gray-500">Loading PIREP detail...</div>;
  }

  if (error || !detail || !selectedFlight) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to recent flights
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "PIREP detail is unavailable."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Button variant="outline" onClick={onBack} className="mb-3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to recent flights
          </Button>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{detail.flightNumber}</h1>
          <p className="text-sm text-gray-500">PIREP detail with recorded telemetry, route progression, and landing data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">#{detail.id}</Badge>
          {detail.bookingId ? <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Booking {detail.bookingId}</Badge> : null}
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">{detail.status || "Completed"}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Route</div>
            <div className="mt-2 text-lg font-bold text-[#1d1d1f]">{detail.departure} → {detail.arrival}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Flight time</div>
            <div className="mt-2 text-lg font-bold text-[#1d1d1f]">{detail.flightTime || "—"}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Distance</div>
            <div className="mt-2 text-lg font-bold text-[#1d1d1f]">{detail.distance || "—"}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Landing</div>
            <div className="mt-2 text-lg font-bold text-green-700">{detail.landing || "—"}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Points</div>
            <div className="mt-2 text-lg font-bold text-[#1d1d1f]">{detail.points ?? "—"}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Score</div>
            <div className="mt-2 text-lg font-bold text-[#1d1d1f]">{detail.score ?? "—"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-white">
              <CardTitle>Telemetry map</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Array.isArray(detail.telemetryTrack) && detail.telemetryTrack.length >= 2 ? (
                <LiveMap flights={[selectedFlight]} selectedFlight={selectedFlight} />
              ) : (
                <div className="flex h-[520px] items-center justify-center bg-slate-950 text-slate-300">
                  Telemetry track is not available for this PIREP yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-white">
              <CardTitle>Altitude and speed profile</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {flightProfileData.hasData ? (
                <div className="space-y-4">
                  {flightProfileData.annotations.length ? (
                    <div className="flex flex-wrap gap-2">
                      {flightProfileData.annotations.map((annotation) => (
                        <Badge key={`${annotation.id}-${annotation.x}`} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                          {formatElapsedTime(annotation.x)} · {annotation.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <ChartContainer config={chartConfig} className="h-[320px] w-full">
                    <LineChart data={flightProfileData.chartData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="elapsed"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={32}
                        tickFormatter={(value) => formatElapsedTime(Number(value || 0))}
                      />
                      <YAxis
                        yAxisId="altitude"
                        tickLine={false}
                        axisLine={false}
                        width={70}
                        tickFormatter={(value) => `${Math.round(Number(value || 0) / 1000)}k`}
                      />
                      <YAxis
                        yAxisId="groundspeed"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tickFormatter={(value) => `${Math.round(Number(value || 0))}`}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                              const elapsed = Number(payload?.[0]?.payload?.elapsed || 0);
                              return `Elapsed ${formatElapsedTime(elapsed)}`;
                            }}
                            formatter={(value, name) => {
                              if (name === "altitude") {
                                return formatCompactMetric(Number(value || 0), "ft");
                              }
                              return formatCompactMetric(Number(value || 0), "kt");
                            }}
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      {flightProfileData.annotations.map((annotation) => (
                        <ReferenceLine
                          key={`annotation-${annotation.id}-${annotation.x}`}
                          x={annotation.x}
                          stroke="rgba(100, 116, 139, 0.35)"
                          strokeDasharray="4 4"
                        />
                      ))}
                      <Line
                        yAxisId="altitude"
                        type="monotone"
                        dataKey="altitude"
                        stroke="var(--color-altitude)"
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        yAxisId="groundspeed"
                        type="monotone"
                        dataKey="groundspeed"
                        stroke="var(--color-groundspeed)"
                        strokeWidth={2.25}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  vAMSYS has not returned altitude or groundspeed profile data for this PIREP yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Flight snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Plane className="h-4 w-4 text-[#E31E24]" /> Aircraft</span>
                <span className="font-medium text-gray-900">{detail.aircraft}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#E31E24]" /> Completed</span>
                <span className="font-medium text-gray-900">{formatDateTime(detail.completedAt || detail.arrivalTime)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#E31E24]" /> Block time</span>
                <span className="font-medium text-gray-900">{detail.blockTime || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Gauge className="h-4 w-4 text-[#E31E24]" /> Altitude</span>
                <span className="font-medium text-gray-900">{detail.altitude ? `${detail.altitude} ft` : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Radio className="h-4 w-4 text-[#E31E24]" /> Network</span>
                <span className="font-medium text-gray-900">{detail.network || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#E31E24]" /> Progress</span>
                <span className="font-medium text-gray-900">{Math.round(Number(detail.progress || 0))}%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#E31E24]" /> Pilot</span>
                <span className="font-medium text-gray-900">{detail.pilot || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2"><Star className="h-4 w-4 text-[#E31E24]" /> Telemetry points</span>
                <span className="font-medium text-gray-900">{Array.isArray(detail.telemetryTrack) ? detail.telemetryTrack.length : 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Operational data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
              <div>
                <div className="mb-1 flex items-center gap-2 font-medium text-gray-900"><MapPin className="h-4 w-4 text-[#E31E24]" /> Departure</div>
                <div>{detail.departure} · {detail.departureName || "—"}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 font-medium text-gray-900"><MapPin className="h-4 w-4 text-[#E31E24]" /> Arrival</div>
                <div>{detail.arrival} · {detail.arrivalName || "—"}</div>
              </div>
              <div>
                <div className="mb-1 font-medium text-gray-900">Comments</div>
                <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{detail.comments || "No remarks attached to this PIREP."}</div>
              </div>
              <div className="space-y-2">
                <div className="mb-1 font-medium text-gray-900">Add comment</div>
                <Textarea
                  value={commentDraft}
                  onChange={(event) => {
                    setCommentDraft(event.target.value);
                    if (commentError) {
                      setCommentError(null);
                    }
                    if (commentSuccess) {
                      setCommentSuccess(null);
                    }
                  }}
                  placeholder="Write a comment for this PIREP review"
                  className="min-h-24"
                  maxLength={1000}
                  disabled={isSubmittingComment}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">{commentDraft.length}/1000</div>
                  <Button onClick={handleSubmitComment} disabled={isSubmittingComment || !commentDraft.trim()}>
                    {isSubmittingComment ? "Sending..." : "Add comment"}
                  </Button>
                </div>
                {commentError ? <div className="text-xs text-red-600">{commentError}</div> : null}
                {commentSuccess ? <div className="text-xs text-green-600">{commentSuccess}</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}