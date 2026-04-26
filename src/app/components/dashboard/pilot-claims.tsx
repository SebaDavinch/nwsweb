import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useNotifications } from "../../context/notifications-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";

interface ClaimBooking {
  id: number;
  flightNumber: string;
  departureCode: string;
  departureName: string;
  arrivalCode: string;
  arrivalName: string;
  routeLabel: string;
  aircraft: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  estimatedArrivalTime?: string | null;
  status: string;
  statusLabel?: string;
  canCancel: boolean;
}

interface ClaimProofItem {
  type: "link" | "image";
  url?: string | null;
  data?: string | null;
}

interface ClaimRecord {
  id: number;
  bookingId?: number | null;
  pirepId?: number | null;
  status: string;
  statusLabel: string;
  needsReply: boolean;
  departureCode: string;
  departureName: string;
  arrivalCode: string;
  arrivalName: string;
  routeLabel: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  message: string;
  proof: ClaimProofItem[];
  proofCount: number;
  createdAt?: string | null;
}

interface ClaimsResponse {
  claims?: ClaimRecord[];
}

interface BookingsResponse {
  bookings?: ClaimBooking[];
}

interface ClaimFormState {
  bookingId: string;
  departureTime: string;
  arrivalTime: string;
  message: string;
  proofLinks: string[];
}

type ClaimStatusFilter = "all" | "pending" | "waiting" | "accepted" | "rejected";

const CLAIM_STATUS_FILTERS: ClaimStatusFilter[] = ["all", "pending", "waiting", "accepted", "rejected"];

const CLAIM_STATUS_BADGE_CLASSNAMES: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  waiting: "border-sky-200 bg-sky-50 text-sky-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

const toLocalDateTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toApiDateTimeValue = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
};

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

const createEmptyClaimForm = (): ClaimFormState => ({
  bookingId: "",
  departureTime: "",
  arrivalTime: "",
  message: "",
  proofLinks: [""],
});

const buildSuggestedClaimTimes = (booking: ClaimBooking | null) => {
  const fallbackDeparture = booking?.departureTime ? new Date(booking.departureTime) : new Date();
  const departure = toLocalDateTimeValue(fallbackDeparture);

  const arrivalSource = booking?.arrivalTime || booking?.estimatedArrivalTime;
  if (arrivalSource) {
    return {
      departureTime: departure,
      arrivalTime: toLocalDateTimeValue(arrivalSource),
    };
  }

  const fallbackArrival = new Date(fallbackDeparture);
  fallbackArrival.setHours(fallbackArrival.getHours() + 2);

  return {
    departureTime: departure,
    arrivalTime: toLocalDateTimeValue(fallbackArrival),
  };
};

const getStatusSortOrder = (status: string) => {
  switch (status) {
    case "active":
      return 0;
    case "upcoming":
      return 1;
    default:
      return 2;
  }
};

export function PilotClaims() {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [bookings, setBookings] = useState<ClaimBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState<ClaimStatusFilter>("all");
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimsMessage, setClaimsMessage] = useState("");
  const [bookingsMessage, setBookingsMessage] = useState("");
  const [form, setForm] = useState<ClaimFormState>(() => createEmptyClaimForm());

  const availableBookings = useMemo(() => {
    return [...bookings]
      .filter((item) => item.canCancel)
      .sort((left, right) => {
        const priorityDiff = getStatusSortOrder(left.status) - getStatusSortOrder(right.status);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const leftTime = Date.parse(String(left.departureTime || ""));
        const rightTime = Date.parse(String(right.departureTime || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });
  }, [bookings]);

  const selectedBooking = useMemo(() => {
    const bookingId = Number(form.bookingId || 0) || 0;
    return availableBookings.find((item) => item.id === bookingId) || null;
  }, [availableBookings, form.bookingId]);

  const loadBookings = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoadingBookings(true);
    }

    try {
      const response = await fetch("/api/pilot/bookings?page[size]=50&sort=departure_time", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as BookingsResponse & {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setBookings([]);
        setBookingsMessage(
          payload?.code === "pilot_api_not_connected"
            ? t("claims.connection.connectPilotApi")
            : payload?.error || t("claims.connection.failedBookings")
        );
        return;
      }

      setBookings(Array.isArray(payload?.bookings) ? payload.bookings : []);
      setBookingsMessage("");
    } catch {
      setBookings([]);
      setBookingsMessage(t("claims.connection.failedBookings"));
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const loadClaims = async (filter: ClaimStatusFilter, { silent = false } = {}) => {
    if (!silent) {
      setIsLoadingClaims(true);
    }

    try {
      const params = new URLSearchParams();
      params.set("page[size]", "20");
      if (filter !== "all") {
        params.set("filter[status]", filter);
      }

      const response = await fetch(`/api/pilot/claims?${params.toString()}`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as ClaimsResponse & {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setClaims([]);
        setClaimsMessage(
          payload?.code === "pilot_api_not_connected"
            ? t("claims.connection.connectPilotApi")
            : payload?.error || t("claims.connection.failedClaims")
        );
        return;
      }

      setClaims(Array.isArray(payload?.claims) ? payload.claims : []);
      setClaimsMessage("");
    } catch {
      setClaims([]);
      setClaimsMessage(t("claims.connection.failedClaims"));
    } finally {
      setIsLoadingClaims(false);
    }
  };

  useEffect(() => {
    void loadBookings();
  }, []);

  useEffect(() => {
    void loadClaims(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    if (!form.bookingId) {
      return;
    }

    const bookingId = Number(form.bookingId || 0) || 0;
    if (!availableBookings.some((item) => item.id === bookingId)) {
      setForm((current) => ({
        ...current,
        bookingId: "",
        departureTime: "",
        arrivalTime: "",
      }));
    }
  }, [availableBookings, form.bookingId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadBookings({ silent: true }),
      loadClaims(statusFilter, { silent: true }),
    ]);
    setIsRefreshing(false);
  };

  const handleBookingChange = (bookingId: string) => {
    const booking = availableBookings.find((item) => item.id === Number(bookingId || 0)) || null;
    const suggestedTimes = buildSuggestedClaimTimes(booking);
    setForm((current) => ({
      ...current,
      bookingId,
      departureTime: suggestedTimes.departureTime,
      arrivalTime: suggestedTimes.arrivalTime,
    }));
  };

  const handleProofLinkChange = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      proofLinks: current.proofLinks.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const handleAddProofLink = () => {
    setForm((current) => ({
      ...current,
      proofLinks: current.proofLinks.length >= 5 ? current.proofLinks : [...current.proofLinks, ""],
    }));
  };

  const handleRemoveProofLink = (index: number) => {
    setForm((current) => {
      if (current.proofLinks.length <= 1) {
        return current;
      }

      return {
        ...current,
        proofLinks: current.proofLinks.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const handleSubmit = async () => {
    const bookingId = Number(form.bookingId || 0) || 0;
    const departureTime = toApiDateTimeValue(form.departureTime);
    const arrivalTime = toApiDateTimeValue(form.arrivalTime);
    const message = form.message.trim();
    const proof = form.proofLinks
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((url) => ({ type: "link", url }));

    if (bookingId <= 0) {
      toast.error(t("claims.validation.bookingRequired"));
      return;
    }

    if (!departureTime || !arrivalTime) {
      toast.error(t("claims.validation.timeRequired"));
      return;
    }

    if (Date.parse(arrivalTime) < Date.parse(departureTime)) {
      toast.error(t("claims.validation.timeOrder"));
      return;
    }

    if (!message) {
      toast.error(t("claims.validation.messageRequired"));
      return;
    }

    if (proof.length < 1) {
      toast.error(t("claims.validation.proofRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pilot/claims", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: bookingId,
          departure_time: departureTime,
          arrival_time: arrivalTime,
          message,
          proof,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        claim?: ClaimRecord | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(String(payload?.error || t("claims.toastError")).trim() || t("claims.toastError"));
      }

      const submittedBooking = selectedBooking;
      toast.success(t("claims.toastSuccess"));
      if (submittedBooking) {
        addNotification({
          category: "claim",
          title: t("claims.notification.title"),
          description: `${submittedBooking.flightNumber} • ${submittedBooking.routeLabel} • ${t("claims.notification.pending")}`,
        });
      }

      setForm(createEmptyClaimForm());
      await Promise.all([
        loadBookings({ silent: true }),
        loadClaims(statusFilter, { silent: true }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("claims.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("claims.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("claims.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing || isLoadingClaims || isLoadingBookings}>
          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {t("claims.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{t("claims.form.title")}</CardTitle>
            <CardDescription>{t("claims.form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {bookingsMessage ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bookingsMessage}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="claim-booking">{t("claims.form.booking")}</Label>
              <Select value={form.bookingId} onValueChange={handleBookingChange}>
                <SelectTrigger id="claim-booking">
                  <SelectValue placeholder={t("claims.form.bookingPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableBookings.map((booking) => (
                    <SelectItem key={booking.id} value={String(booking.id)}>
                      {booking.flightNumber} • {booking.routeLabel} • {booking.statusLabel || booking.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoadingBookings ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("claims.loading")}
              </div>
            ) : null}

            {!isLoadingBookings && availableBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <div className="font-semibold text-[#1d1d1f]">{t("claims.form.noBookings")}</div>
                <div className="mt-1 text-sm text-gray-500">{t("claims.form.noBookingsDesc")}</div>
              </div>
            ) : null}

            {selectedBooking ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#E31E24] text-white">{selectedBooking.flightNumber}</Badge>
                  <Badge variant="outline">{selectedBooking.routeLabel}</Badge>
                </div>
                <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                  <div>
                    <div className="font-medium text-[#1d1d1f]">{selectedBooking.departureName}</div>
                    <div>{selectedBooking.departureCode}</div>
                  </div>
                  <div>
                    <div className="font-medium text-[#1d1d1f]">{selectedBooking.arrivalName}</div>
                    <div>{selectedBooking.arrivalCode}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("claims.form.scheduledDeparture")}</div>
                    <div>{formatDateTime(selectedBooking.departureTime)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("claims.form.aircraft")}</div>
                    <div>{selectedBooking.aircraft}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="claim-departure-time">{t("claims.form.departureTime")}</Label>
                <Input
                  id="claim-departure-time"
                  type="datetime-local"
                  value={form.departureTime}
                  onChange={(event) => setForm((current) => ({ ...current, departureTime: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim-arrival-time">{t("claims.form.arrivalTime")}</Label>
                <Input
                  id="claim-arrival-time"
                  type="datetime-local"
                  value={form.arrivalTime}
                  onChange={(event) => setForm((current) => ({ ...current, arrivalTime: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="claim-message">{t("claims.form.message")}</Label>
              <Textarea
                id="claim-message"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder={t("claims.form.messagePlaceholder")}
                className="min-h-28"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-[#1d1d1f]">{t("claims.form.proof")}</div>
                  <div className="text-sm text-gray-500">{t("claims.form.proofHint")}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddProofLink} disabled={form.proofLinks.length >= 5}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("claims.form.addProof")}
                </Button>
              </div>

              <div className="space-y-3">
                {form.proofLinks.map((value, index) => (
                  <div key={`proof-${index}`} className="flex items-center gap-2">
                    <Input
                      type="url"
                      value={value}
                      onChange={(event) => handleProofLinkChange(index, event.target.value)}
                      placeholder={`https://... (${index + 1})`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveProofLink(index)}
                      disabled={form.proofLinks.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-[#E31E24] text-white hover:bg-[#c41a20]"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoadingBookings || availableBookings.length === 0}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              {isSubmitting ? t("claims.form.submitting") : t("claims.form.submit")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{t("claims.history.title")}</CardTitle>
            <CardDescription>{t("claims.history.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CLAIM_STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  variant="outline"
                  size="sm"
                  className={cn(
                    statusFilter === filter ? "border-[#E31E24] bg-red-50 text-[#E31E24]" : "text-gray-600"
                  )}
                  onClick={() => setStatusFilter(filter)}
                >
                  {t(`claims.status.${filter}`)}
                </Button>
              ))}
            </div>

            {claimsMessage ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {claimsMessage}
              </div>
            ) : null}

            {isLoadingClaims ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("claims.loading")}
              </div>
            ) : null}

            {!isLoadingClaims && !claimsMessage && claims.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="font-semibold text-[#1d1d1f]">{t("claims.history.empty")}</div>
                <div className="mt-1 text-sm text-gray-500">{t("claims.history.emptyDesc")}</div>
              </div>
            ) : null}

            <div className="space-y-4">
              {claims.map((claim) => (
                <div key={claim.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-[#1d1d1f]">{claim.routeLabel}</div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border",
                            CLAIM_STATUS_BADGE_CLASSNAMES[claim.status] || "border-gray-200 bg-gray-50 text-gray-700"
                          )}
                        >
                          {t(`claims.status.${claim.status}`)}
                        </Badge>
                        {claim.needsReply ? (
                          <Badge className="bg-amber-500 text-white">{t("claims.details.needsReply")}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {claim.departureCode} {"→"} {claim.arrivalCode}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      <div>{t("claims.details.submitted")}</div>
                      <div>{formatDateTime(claim.createdAt)}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-gray-600">{claim.message || "—"}</p>

                  <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">{t("claims.details.departure")}</div>
                      <div>{formatDateTime(claim.departureTime)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">{t("claims.details.arrival")}</div>
                      <div>{formatDateTime(claim.arrivalTime)}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("claims.details.proof")}</div>
                    {claim.proof.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {claim.proof.map((item, index) => {
                          const url = String(item?.url || "").trim();
                          if (!url) {
                            return null;
                          }

                          return (
                            <a
                              key={`${claim.id}-proof-${index}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {`${t("claims.details.proof")} #${index + 1}`}
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">{t("claims.details.noProof")}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}