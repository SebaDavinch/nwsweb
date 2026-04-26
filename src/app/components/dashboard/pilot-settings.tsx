import { useEffect, useState } from "react";
import { Bell, Lock, MapPinned, MessageSquare, Plane, Shield } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

interface DiscordSessionUser {
  id?: string;
  username?: string;
  globalName?: string;
}

interface PilotApiProfile {
  id?: string;
  username?: string;
  name?: string;
  email?: string;
  avatar?: string;
  location?: string;
  rank?: string;
}

interface PilotApiStatus {
  configured?: boolean;
  connected?: boolean;
  connectedAt?: string | null;
  expiresAt?: number | null;
  profileSyncedAt?: number | null;
  scope?: string;
  profile?: PilotApiProfile | null;
}

interface NotificationPreferences {
  channels: {
    email: boolean;
    discord: boolean;
    browser: boolean;
  };
  notificationTypes: {
    booking: boolean;
    claim: boolean;
    review: boolean;
    notam: boolean;
    badge: boolean;
    event: boolean;
    system: boolean;
  };
}

interface PilotPreferenceSettings {
  preferredNetwork: string;
  sbPreferences: string[];
  useImperialUnits: boolean;
}

const defaultNotificationPreferences: NotificationPreferences = {
  channels: {
    email: true,
    discord: true,
    browser: false,
  },
  notificationTypes: {
    booking: true,
    claim: true,
    review: true,
    notam: true,
    badge: true,
    event: true,
    system: true,
  },
};

export function PilotSettings() {
  const { t } = useLanguage();
  const { connectPilotApi, loginWithDiscord } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [discordUser, setDiscordUser] = useState<DiscordSessionUser | null>(null);
  const [isLoadingDiscord, setIsLoadingDiscord] = useState(true);
  const [pilotApiStatus, setPilotApiStatus] = useState<PilotApiStatus | null>(null);
  const [isLoadingPilotApi, setIsLoadingPilotApi] = useState(true);
  const [pilotLocationCode, setPilotLocationCode] = useState("");
  const [pilotPreferences, setPilotPreferences] = useState<PilotPreferenceSettings>({
    preferredNetwork: "offline",
    sbPreferences: [],
    useImperialUnits: false,
  });
  const [sbPreferencesText, setSbPreferencesText] = useState("");
  const [isSavingPilotLocation, setIsSavingPilotLocation] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSavingPilotPreferences, setIsSavingPilotPreferences] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const discordState = String(params.get("discord") || "").trim().toLowerCase();
    const pilotApiState = String(params.get("pilot_api") || "").trim().toLowerCase();
    const reason = String(params.get("reason") || "").trim();

    if (discordState === "success") {
      toast.success(t("settings.discord.toastSuccess"));
    } else if (discordState === "error") {
      toast.error(t("settings.discord.toastError"), {
        description: reason || undefined,
      });
    } else if (pilotApiState === "success") {
      toast.success(t("settings.pilotApi.toastSuccess"));
    } else if (pilotApiState === "error") {
      toast.error(t("settings.pilotApi.toastError"), {
        description: reason || undefined,
      });
    } else {
      return;
    }

    params.delete("discord");
    params.delete("pilot_api");
    params.delete("reason");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate, t]);

  useEffect(() => {
    let isMounted = true;

    const loadNotificationPreferences = async () => {
      try {
        const response = await fetch("/api/pilot/preferences", { credentials: "include" });
        if (!response.ok || !isMounted) {
          return;
        }

        const payload = await response.json().catch(() => null);
        const nextNotifications = payload?.preferences?.notifications;
        if (nextNotifications && typeof nextNotifications === "object") {
          setNotifications({
            channels: {
              ...defaultNotificationPreferences.channels,
              ...(nextNotifications?.channels && typeof nextNotifications.channels === "object"
                ? nextNotifications.channels
                : {}),
            },
            notificationTypes: {
              ...defaultNotificationPreferences.notificationTypes,
              ...(nextNotifications?.notificationTypes && typeof nextNotifications.notificationTypes === "object"
                ? nextNotifications.notificationTypes
                : {}),
            },
          });
        }

        const nextPilotPreferences = payload?.pilotApiPreferences;
        if (nextPilotPreferences && typeof nextPilotPreferences === "object") {
          const normalized = {
            preferredNetwork: String(nextPilotPreferences?.preferredNetwork || "offline").trim().toLowerCase() || "offline",
            sbPreferences: Array.isArray(nextPilotPreferences?.sbPreferences)
              ? nextPilotPreferences.sbPreferences.map((item: unknown) => String(item || "").trim()).filter(Boolean)
              : [],
            useImperialUnits: Boolean(nextPilotPreferences?.useImperialUnits),
          };
          setPilotPreferences(normalized);
          setSbPreferencesText(normalized.sbPreferences.join(", "));
        }
      } catch {
        // ignore and keep defaults
      }
    };

    const loadPilotApiStatus = async () => {
      setIsLoadingPilotApi(true);
      try {
        const response = await fetch("/api/auth/pilot-api/status", { credentials: "include" });
        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setPilotApiStatus(null);
          return;
        }

        const payload = await response.json();
        setPilotApiStatus(payload || null);
      } catch {
        if (isMounted) {
          setPilotApiStatus(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPilotApi(false);
        }
      }
    };

  loadPilotApiStatus();
  loadNotificationPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistNotifications = async (nextNotifications: NotificationPreferences) => {
    setIsSavingNotifications(true);
    try {
      const response = await fetch("/api/pilot/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notifications: nextNotifications,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || t("settings.notifications.saveError")));
      }

      toast.success(t("settings.notifications.saved"));
    } catch (error) {
      toast.error(String(error || t("settings.notifications.saveError")));
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const updateChannelPreference = (channelKey: keyof NotificationPreferences["channels"], checked: boolean) => {
    const nextNotifications = {
      ...notifications,
      channels: {
        ...notifications.channels,
        [channelKey]: checked,
      },
    };
    setNotifications(nextNotifications);
    void persistNotifications(nextNotifications);
  };

  const updateTypePreference = (typeKey: keyof NotificationPreferences["notificationTypes"], checked: boolean) => {
    const nextNotifications = {
      ...notifications,
      notificationTypes: {
        ...notifications.notificationTypes,
        [typeKey]: checked,
      },
    };
    setNotifications(nextNotifications);
    void persistNotifications(nextNotifications);
  };

  useEffect(() => {
    let isMounted = true;

    const loadDiscordSession = async () => {
      setIsLoadingDiscord(true);
      try {
        const response = await fetch("/api/auth/discord/me", { credentials: "include" });
        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setDiscordUser(null);
          return;
        }

        const payload = await response.json();
        setDiscordUser(payload?.user || null);
      } catch {
        if (isMounted) {
          setDiscordUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingDiscord(false);
        }
      }
    };

    loadDiscordSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDisconnectDiscord = async () => {
    try {
      await fetch("/api/auth/discord/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setDiscordUser(null);
  };

  const refreshPilotApiStatus = async () => {
    setIsLoadingPilotApi(true);
    try {
      const response = await fetch("/api/auth/pilot-api/status?refresh=1", {
        credentials: "include",
      });
      if (!response.ok) {
        setPilotApiStatus(null);
        return;
      }

      const payload = await response.json();
      setPilotApiStatus(payload || null);
    } catch {
      setPilotApiStatus(null);
    } finally {
      setIsLoadingPilotApi(false);
    }
  };

  const handleDisconnectPilotApi = async () => {
    try {
      await fetch("/api/auth/pilot-api/disconnect", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }

    setPilotApiStatus((prev) => ({
      ...(prev || {}),
      configured: prev?.configured,
      connected: false,
      profile: null,
    }));
    setPilotLocationCode("");
  };

  const handleUpdatePilotLocation = async (airportCode?: string | null) => {
    setIsSavingPilotLocation(true);
    try {
      const response = await fetch("/api/pilot/location", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          airportCode: airportCode === null ? null : String(airportCode || pilotLocationCode || "").trim().toUpperCase(),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to update pilot location"));
      }

      toast.success(airportCode === null ? "Pilot location cleared" : "Pilot location updated");
      setPilotLocationCode("");
      await refreshPilotApiStatus();
    } catch (error) {
      toast.error(String(error || "Failed to update pilot location"));
    } finally {
      setIsSavingPilotLocation(false);
    }
  };

  const handleSavePilotPreferences = async () => {
    setIsSavingPilotPreferences(true);
    try {
      const normalizedSbPreferences = sbPreferencesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch("/api/pilot/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredNetwork: pilotPreferences.preferredNetwork,
          sbPreferences: normalizedSbPreferences,
          useImperialUnits: pilotPreferences.useImperialUnits,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || t("settings.pilotApi.preferences.saveError")));
      }

      setPilotPreferences({
        preferredNetwork: String(payload?.pilotApiPreferences?.preferredNetwork || pilotPreferences.preferredNetwork).trim().toLowerCase() || "offline",
        sbPreferences: Array.isArray(payload?.pilotApiPreferences?.sbPreferences)
          ? payload.pilotApiPreferences.sbPreferences.map((item: unknown) => String(item || "").trim()).filter(Boolean)
          : normalizedSbPreferences,
        useImperialUnits: Boolean(payload?.pilotApiPreferences?.useImperialUnits ?? pilotPreferences.useImperialUnits),
      });
      setSbPreferencesText(normalizedSbPreferences.join(", "));
      toast.success(t("settings.pilotApi.preferences.saved"));
      await refreshPilotApiStatus();
    } catch (error) {
      toast.error(String(error || t("settings.pilotApi.preferences.saveError")));
    } finally {
      setIsSavingPilotPreferences(false);
    }
  };

  const discordDisplay =
    String(discordUser?.globalName || "").trim() || String(discordUser?.username || "").trim() || "Discord";
  const pilotApiProfile = pilotApiStatus?.profile || null;
  const pilotApiConnected = Boolean(pilotApiStatus?.connected);
  const pilotApiConfigured = Boolean(pilotApiStatus?.configured);
  const pilotApiDisplayName =
    String(pilotApiProfile?.name || "").trim() || String(pilotApiProfile?.username || "").trim() || "vAMSYS";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("settings.title")}</h1>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#E31E24]" />
              <CardTitle>{t("settings.notifications.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.notifications.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                <span>{t("settings.notifications.email")}</span>
                <span className="font-normal text-xs text-muted-foreground">
                  {t("settings.notifications.email.desc")}
                </span>
              </Label>
              <Switch
                id="email-notifications"
                checked={notifications.channels.email}
                disabled={isSavingNotifications}
                onCheckedChange={(checked) => updateChannelPreference("email", checked)}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="discord-notifications" className="flex flex-col space-y-1">
                <span>{t("settings.notifications.discord")}</span>
                <span className="font-normal text-xs text-muted-foreground">
                  {t("settings.notifications.discord.desc")}
                </span>
              </Label>
              <Switch
                id="discord-notifications"
                checked={notifications.channels.discord}
                onCheckedChange={(checked) => updateChannelPreference("discord", checked)}
                disabled={!discordUser || isSavingNotifications}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="browser-notifications" className="flex flex-col space-y-1">
                <span>{t("settings.notifications.browser")}</span>
                <span className="font-normal text-xs text-muted-foreground">
                  {t("settings.notifications.browser.desc")}
                </span>
              </Label>
              <Switch
                id="browser-notifications"
                checked={notifications.channels.browser}
                disabled={isSavingNotifications}
                onCheckedChange={(checked) => updateChannelPreference("browser", checked)}
              />
            </div>

            <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/80 p-4">
              <div>
                <div className="font-medium text-[#1d1d1f]">{t("settings.notifications.types")}</div>
                <div className="text-xs text-muted-foreground">{t("settings.notifications.types.desc")}</div>
              </div>

              {([
                "booking",
                "claim",
                "review",
                "notam",
                "badge",
                "event",
                "system",
              ] as Array<keyof NotificationPreferences["notificationTypes"]>).map((typeKey) => (
                <div key={typeKey} className="flex items-center justify-between space-x-2">
                  <Label htmlFor={`notification-type-${typeKey}`} className="flex flex-col space-y-1">
                    <span>{t(`settings.notifications.types.${typeKey}`)}</span>
                  </Label>
                  <Switch
                    id={`notification-type-${typeKey}`}
                    checked={notifications.notificationTypes[typeKey]}
                    disabled={isSavingNotifications}
                    onCheckedChange={(checked) => updateTypePreference(typeKey, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-[#E31E24]" />
              <CardTitle>{t("settings.pilotApi.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.pilotApi.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPilotApi ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : !pilotApiConfigured ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("settings.pilotApi.notConfigured")}
              </div>
            ) : pilotApiConnected ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900">{t("settings.pilotApi.connected")}</div>
                    <div className="text-sm text-green-700 truncate">{pilotApiDisplayName}</div>
                    {pilotApiProfile?.email ? (
                      <div className="text-xs text-green-700 truncate">{pilotApiProfile.email}</div>
                    ) : null}
                    {pilotApiProfile?.location ? (
                      <div className="text-xs text-green-700 truncate">{pilotApiProfile.location}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={refreshPilotApiStatus}>
                      {t("settings.pilotApi.refresh")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDisconnectPilotApi}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {t("settings.pilotApi.disconnect")}
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <MapPinned className="w-4 h-4 text-[#E31E24]" />
                    Pilot location
                  </div>
                  <div className="text-sm text-gray-500">
                    Current location: {pilotApiProfile?.location ? pilotApiProfile.location : "not set"}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={pilotLocationCode}
                      onChange={(event) => setPilotLocationCode(event.target.value.toUpperCase())}
                      placeholder="ICAO, for example UUEE"
                      maxLength={4}
                      className="sm:max-w-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleUpdatePilotLocation()}
                        disabled={isSavingPilotLocation || !pilotLocationCode.trim()}
                      >
                        {isSavingPilotLocation ? "Saving..." : "Save location"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleUpdatePilotLocation(null)}
                        disabled={isSavingPilotLocation}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{t("settings.pilotApi.preferences.title")}</div>
                    <div className="text-xs text-gray-500">{t("settings.pilotApi.preferences.desc")}</div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.pilotApi.preferences.network")}</Label>
                    <Select
                      value={pilotPreferences.preferredNetwork}
                      onValueChange={(value) => setPilotPreferences((current) => ({ ...current, preferredNetwork: value }))}
                      disabled={isSavingPilotPreferences}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.pilotApi.preferences.network")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="vatsim">VATSIM</SelectItem>
                        <SelectItem value="ivao">IVAO</SelectItem>
                        <SelectItem value="poscon">POSCON</SelectItem>
                        <SelectItem value="pilotedge">PilotEdge</SelectItem>
                        <SelectItem value="fscloud">FSCloud</SelectItem>
                        <SelectItem value="sayintentions">SayIntentions</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.pilotApi.preferences.sbPreferences")}</Label>
                    <Input
                      value={sbPreferencesText}
                      onChange={(event) => setSbPreferencesText(event.target.value)}
                      placeholder={t("settings.pilotApi.preferences.sbPreferencesPlaceholder")}
                      disabled={isSavingPilotPreferences}
                    />
                    <div className="text-xs text-gray-500">{t("settings.pilotApi.preferences.sbPreferencesHint")}</div>
                  </div>

                  <div className="flex items-center justify-between space-x-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                    <Label className="flex flex-col space-y-1">
                      <span>{t("settings.pilotApi.preferences.imperial")}</span>
                      <span className="font-normal text-xs text-muted-foreground">{t("settings.pilotApi.preferences.imperialDesc")}</span>
                    </Label>
                    <Switch
                      checked={pilotPreferences.useImperialUnits}
                      disabled={isSavingPilotPreferences}
                      onCheckedChange={(checked) =>
                        setPilotPreferences((current) => ({ ...current, useImperialUnits: Boolean(checked) }))
                      }
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSavePilotPreferences}
                      disabled={isSavingPilotPreferences}
                      className="bg-[#E31E24] hover:bg-[#c21920] text-white"
                    >
                      {isSavingPilotPreferences ? t("settings.pilotApi.preferences.saving") : t("settings.pilotApi.preferences.save")}
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-gray-500">{t("settings.pilotApi.syncHint")}</div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">{t("settings.pilotApi.notConnected")}</div>
                <Button
                  onClick={() => connectPilotApi("/dashboard?tab=settings")}
                  className="bg-[#E31E24] hover:bg-[#c21920] text-white w-full sm:w-auto"
                >
                  <Plane className="w-4 h-4 mr-2" />
                  {t("settings.pilotApi.connect")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />
              <CardTitle>{t("settings.discord.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.discord.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDiscord ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : discordUser ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-[#5865F2] rounded-full flex items-center justify-center text-white">
                    <MessageSquare size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900">{t("settings.discord.connected")}</div>
                    <div className="text-sm text-green-700 truncate">{discordDisplay}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnectDiscord}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  {t("settings.discord.disconnect")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">{t("settings.discord.disclaimer")}</div>
                <Button
                  onClick={() => loginWithDiscord("/dashboard?tab=settings", "link")}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white w-full sm:w-auto"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t("settings.discord.connect")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-500" />
              <CardTitle>{t("settings.security.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.security.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full sm:w-auto">
              <Lock className="w-4 h-4 mr-2" />
              {t("settings.security.changePassword")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
