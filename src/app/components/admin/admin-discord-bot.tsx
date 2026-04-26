import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Bot, Loader2, Save, Search, Shield, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface NotificationTemplate {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

interface DiscordAdminUser {
  id: string;
  discordId: string;
  username?: string;
  email?: string;
  role?: "admin" | "staff";
  linkedBy?: string;
}

interface DiscordGuildRole {
  id: string;
  name: string;
  color: string;
  position: number;
  managed: boolean;
  mentionable: boolean;
  selected: boolean;
}

interface DiscordGuildChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
}

interface DiscordGuildInfo {
  id: string;
  name: string;
  iconUrl: string | null;
  approximateMemberCount: number | null;
}

interface DiscordGuildMemberRole {
  id: string;
  name: string;
  color: string;
}

interface DiscordGuildMember {
  discordId: string;
  username: string;
  discriminator: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  nick: string | null;
  roleIds: string[];
  roles: DiscordGuildMemberRole[];
}

interface DiscordGuildSnapshot {
  configured: boolean;
  guild: DiscordGuildInfo | null;
  roles: DiscordGuildRole[];
  channels: DiscordGuildChannel[];
  adminRoleIds: string[];
  adminUsers: DiscordAdminUser[];
}

interface DiscordBotSettings {
  enabled: boolean;
  webhookUrl: string;
  monitoredGuildId: string;
  adminRoleIds: string[];
  sync: {
    tickets: boolean;
    news: boolean;
    notams: boolean;
    alerts: boolean;
  };
  notifications: {
    bookingCreated: boolean;
    flightTakeoff: boolean;
    flightLanding: boolean;
    pirepReview: boolean;
    ticketCreated: boolean;
    ticketReply: boolean;
    ticketUpdated: boolean;
    ticketClosed: boolean;
    newsCreated: boolean;
    notamCreated: boolean;
    alertCreated: boolean;
  };
  channels: {
    bookings: string;
    flights: string;
    pirepReview: string;
    tickets: string;
    news: string;
    notams: string;
    alerts: string;
  };
  templates?: Record<string, NotificationTemplate>;
}

const SYNC_KEYS: Array<keyof DiscordBotSettings["sync"]> = ["tickets", "news", "notams", "alerts"];

const CHANNEL_FIELDS: Array<{ key: keyof DiscordBotSettings["channels"]; label: string; description: string }> = [
  { key: "bookings", label: "Bookings", description: "Booking create/update notifications." },
  { key: "flights", label: "Flights", description: "Takeoff and landing updates." },
  { key: "pirepReview", label: "PIREP Review", description: "Review queue reminders." },
  { key: "tickets", label: "Tickets", description: "Created, updated, replied, closed." },
  { key: "news", label: "News", description: "Published website news." },
  { key: "notams", label: "NOTAMs", description: "Operational bulletins." },
  { key: "alerts", label: "Alerts", description: "Dashboard and ops alerts." },
];

const NOTIFICATION_FIELDS: Array<{ key: keyof DiscordBotSettings["notifications"]; label: string; description: string }> = [
  { key: "bookingCreated", label: "Booking Created", description: "Pilot booking created." },
  { key: "flightTakeoff", label: "Flight Takeoff", description: "Departure event notification." },
  { key: "flightLanding", label: "Flight Landing", description: "Arrival event notification." },
  { key: "pirepReview", label: "PIREP Review", description: "New review queue item." },
  { key: "ticketCreated", label: "Ticket Created", description: "New support ticket submitted." },
  { key: "ticketReply", label: "Ticket Reply", description: "New message in existing ticket." },
  { key: "ticketUpdated", label: "Ticket Updated", description: "Priority, assignee or status changed." },
  { key: "ticketClosed", label: "Ticket Closed", description: "Ticket moved to closed state." },
  { key: "newsCreated", label: "News Created", description: "Website news published." },
  { key: "notamCreated", label: "NOTAM Created", description: "NOTAM created or updated." },
  { key: "alertCreated", label: "Alert Created", description: "Alert created or updated." },
];

export function AdminDiscordBot() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [isMutatingAccess, setIsMutatingAccess] = useState(false);
  const [settings, setSettings] = useState<DiscordBotSettings | null>(null);
  const [guildSnapshot, setGuildSnapshot] = useState<DiscordGuildSnapshot | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<DiscordGuildMember[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [configResponse, guildResponse] = await Promise.all([
        fetch("/api/admin/discord-bot/config", { credentials: "include" }),
        fetch("/api/admin/discord-bot/guild", { credentials: "include" }),
      ]);

      const configPayload = configResponse.ok ? await configResponse.json() : null;
      const guildPayload = guildResponse.ok ? await guildResponse.json() : null;

      setSettings(configPayload?.botSettings || null);
      setGuildSnapshot(guildPayload || null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const templateKeys = useMemo(() => {
    const keys = new Set<string>(NOTIFICATION_FIELDS.map((item) => item.key));
    Object.keys(settings?.templates || {}).forEach((key) => keys.add(key));
    return Array.from(keys.values());
  }, [settings?.templates]);

  const availableTextChannels = useMemo(
    () => (guildSnapshot?.channels || []).filter((channel) => [0, 5, 10, 11, 12, 15].includes(channel.type)),
    [guildSnapshot?.channels]
  );

  const currentAdminUsers = guildSnapshot?.adminUsers || [];

  const updateSync = (key: keyof DiscordBotSettings["sync"], value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, sync: { ...prev.sync, [key]: value } } : prev));
  };

  const updateNotification = (key: keyof DiscordBotSettings["notifications"], value: boolean) => {
    setSettings((prev) =>
      prev ? { ...prev, notifications: { ...prev.notifications, [key]: value } } : prev
    );
  };

  const updateChannel = (key: keyof DiscordBotSettings["channels"], value: string) => {
    setSettings((prev) => (prev ? { ...prev, channels: { ...prev.channels, [key]: value } } : prev));
  };

  const updateTemplate = (templateId: string, patch: Partial<NotificationTemplate>) => {
    setSettings((prev) => {
      if (!prev) {
        return prev;
      }

      const currentTemplate = prev.templates?.[templateId] || {
        id: templateId,
        title: "",
        description: "",
        enabled: true,
      };

      return {
        ...prev,
        templates: {
          ...(prev.templates || {}),
          [templateId]: {
            ...currentTemplate,
            ...patch,
          },
        },
      };
    });
  };

  const toggleAdminRole = (roleId: string) => {
    setSettings((prev) => {
      if (!prev) {
        return prev;
      }

      const current = new Set(prev.adminRoleIds || []);
      if (current.has(roleId)) {
        current.delete(roleId);
      } else {
        current.add(roleId);
      }

      return {
        ...prev,
        adminRoleIds: Array.from(current),
      };
    });
  };

  const save = async () => {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    try {
      await fetch("/api/admin/discord-bot/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const searchMembers = useCallback(async () => {
    if (memberQuery.trim().length < 2) {
      setMemberResults([]);
      return;
    }

    setIsSearchingMembers(true);
    try {
      const response = await fetch(`/api/admin/discord-bot/members?query=${encodeURIComponent(memberQuery.trim())}`, {
        credentials: "include",
      });
      const payload = response.ok ? await response.json() : null;
      setMemberResults(Array.isArray(payload?.members) ? payload.members : []);
    } finally {
      setIsSearchingMembers(false);
    }
  }, [memberQuery]);

  const grantAccess = async (member: DiscordGuildMember, role: "admin" | "staff") => {
    setIsMutatingAccess(true);
    try {
      await fetch("/api/admin/access/grant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: member.discordId,
          username: member.username,
          role,
        }),
      });
      await loadData();
    } finally {
      setIsMutatingAccess(false);
    }
  };

  const revokeAccess = async (discordId: string) => {
    setIsMutatingAccess(true);
    try {
      await fetch("/api/admin/access/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId }),
      });
      await loadData();
    } finally {
      setIsMutatingAccess(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading bot settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Discord Bot</h2>
          <p className="text-sm text-gray-500">
            Manage sync, routing, guild roles and admin access for the Discord bot.
          </p>
        </div>
        <Button onClick={save} disabled={isSaving} className="bg-[#E31E24] hover:bg-[#c91a1f]">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">General settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <div className="font-medium text-gray-900">Bot integration enabled</div>
                  <div className="text-xs text-gray-500">Master switch for all website to Discord bot actions.</div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => (prev ? { ...prev, enabled: Boolean(checked) } : prev))
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Monitored guild ID</label>
                  <Input
                    value={settings.monitoredGuildId || ""}
                    onChange={(event) =>
                      setSettings((prev) => (prev ? { ...prev, monitoredGuildId: event.target.value } : prev))
                    }
                    placeholder="Discord guild/server ID"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Webhook URL fallback</label>
                  <Input
                    value={settings.webhookUrl || ""}
                    onChange={(event) =>
                      setSettings((prev) => (prev ? { ...prev, webhookUrl: event.target.value } : prev))
                    }
                    placeholder="Optional fallback when bot token channel send is unavailable"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {guildSnapshot?.guild?.name || "Discord server not linked yet"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {guildSnapshot?.configured
                        ? `Guild ID ${guildSnapshot.guild?.id} • Roles ${guildSnapshot.roles.length} • Channels ${guildSnapshot.channels.length}`
                        : "Set a monitored guild ID and make sure the bot has access to the server."}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Content sync</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SYNC_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <div className="font-medium capitalize text-gray-900">{key}</div>
                    <div className="text-xs text-gray-500">Allow Discord to sync this content into the website.</div>
                  </div>
                  <Switch checked={Boolean(settings.sync[key])} onCheckedChange={(checked) => updateSync(key, Boolean(checked))} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Notification toggles</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {NOTIFICATION_FIELDS.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div className="pr-4">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                  <Switch
                    checked={Boolean(settings.notifications[item.key])}
                    onCheckedChange={(checked) => updateNotification(item.key, Boolean(checked))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Channel routing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHANNEL_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2 rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <Bell className="h-4 w-4 text-gray-500" />
                    {field.label}
                  </div>
                  <div className="text-xs text-gray-500">{field.description}</div>
                  <Input
                    value={settings.channels[field.key] || ""}
                    onChange={(event) => updateChannel(field.key, event.target.value)}
                    placeholder="Discord channel ID"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Available text channels</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableTextChannels.length > 0 ? (
                availableTextChannels.map((channel) => (
                  <div key={channel.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="font-medium text-gray-900">#{channel.name}</div>
                    <div className="text-xs text-gray-500">{channel.id}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No guild channel data available yet.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Admin roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Selected roles get elevated bot access and are used for ticket mentions.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(guildSnapshot?.roles || []).map((role) => {
                  const checked = (settings.adminRoleIds || []).includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleAdminRole(role.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        checked ? "border-[#E31E24] bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-gray-900">{role.name}</div>
                        <div className={`h-3 w-3 rounded-full ${checked ? "bg-[#E31E24]" : "bg-gray-300"}`} />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {role.id} • Position {role.position}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Individual access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="Search guild members by username or display name"
                />
                <Button onClick={() => searchMembers()} disabled={isSearchingMembers}>
                  {isSearchingMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Search
                </Button>
              </div>

              <div className="space-y-3">
                {memberResults.map((member) => (
                  <div key={member.discordId} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {member.nick || member.globalName || member.username}
                        </div>
                        <div className="text-xs text-gray-500">
                          @{member.username} • {member.discordId}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {member.roles.slice(0, 6).map((role) => (
                            <span key={role.id} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={isMutatingAccess} onClick={() => grantAccess(member, "staff")}>
                          <Shield className="mr-2 h-4 w-4" />
                          Grant Staff
                        </Button>
                        <Button size="sm" disabled={isMutatingAccess} onClick={() => grantAccess(member, "admin")}>
                          <UserCog className="mr-2 h-4 w-4" />
                          Grant Admin
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {!isSearchingMembers && memberQuery.trim().length >= 2 && memberResults.length === 0 ? (
                  <div className="text-sm text-gray-500">No matching guild members found.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Current privileged users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentAdminUsers.length > 0 ? (
                currentAdminUsers.map((user) => (
                  <div key={user.discordId || user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                    <div>
                      <div className="font-medium text-gray-900">{user.username || user.discordId}</div>
                      <div className="text-xs text-gray-500">
                        {user.discordId} • {(user.role || "admin").toUpperCase()}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled={isMutatingAccess} onClick={() => revokeAccess(user.discordId)}>
                      Revoke
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No individual access grants yet.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Notification templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Customize embed title and body with variables like <code>{"{{ticketNumber}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{content}}"}</code>, <code>{"{{status}}"}</code>.
              </p>

              {templateKeys.map((templateId) => {
                const template = settings.templates?.[templateId] || {
                  id: templateId,
                  title: "",
                  description: "",
                  enabled: true,
                };

                return (
                  <div key={templateId} className="space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">{templateId}</div>
                      <Switch
                        checked={Boolean(template.enabled)}
                        onCheckedChange={(checked) => updateTemplate(templateId, { enabled: Boolean(checked) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">Embed title</label>
                      <Input
                        value={template.title || ""}
                        onChange={(event) => updateTemplate(templateId, { title: event.target.value })}
                        placeholder="Embed title template"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">Embed description</label>
                      <Textarea
                        value={template.description || ""}
                        onChange={(event) => updateTemplate(templateId, { description: event.target.value })}
                        placeholder="Embed description template"
                        rows={3}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
