import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, RefreshCw, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

interface TicketConfigItem {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  order?: number;
}

interface TicketConfig {
  enabled: boolean;
  categories: TicketConfigItem[];
  tags: TicketConfigItem[];
  assignees: TicketConfigItem[];
}

interface TicketMessage {
  id: string;
  authorRole: "pilot" | "staff";
  authorName: string;
  content: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  number: number;
  subject: string;
  categoryId: string;
  categoryName: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  tags: string[];
  assigneeId?: string | null;
  assigneeName?: string | null;
  unreadByStaff: number;
  unreadByOwner: number;
  owner?: { name?: string; username?: string };
  messages: TicketMessage[];
  updatedAt: string;
}

const statusBadgeClass: Record<Ticket["status"], string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-sky-200 bg-sky-50 text-sky-700",
  closed: "border-gray-200 bg-gray-50 text-gray-700",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export function AdminTickets() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [config, setConfig] = useState<TicketConfig>({ enabled: true, categories: [], tags: [], assignees: [] });
  const [reply, setReply] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  // New item forms
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newAssigneeName, setNewAssigneeName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configRes, ticketsRes] = await Promise.all([
        fetch("/api/admin/tickets/config", { credentials: "include" }),
        fetch("/api/admin/tickets", { credentials: "include" }),
      ]);

      const configPayload = configRes.ok ? await configRes.json() : {};
      const ticketPayload = ticketsRes.ok ? await ticketsRes.json() : {};

      const nextConfig = configPayload?.ticketConfig;
      const nextTickets = Array.isArray(ticketPayload?.tickets) ? ticketPayload.tickets : [];

      setConfig({
        enabled: Boolean(nextConfig?.enabled ?? true),
        categories: Array.isArray(nextConfig?.categories) ? nextConfig.categories : [],
        tags: Array.isArray(nextConfig?.tags) ? nextConfig.tags : [],
        assignees: Array.isArray(nextConfig?.assignees) ? nextConfig.assignees : [],
      });
      setTickets(nextTickets);

      if (!selectedTicketId && nextTickets.length > 0) {
        setSelectedTicketId(String(nextTickets[0].id || ""));
      }
      if (selectedTicketId && !nextTickets.some((item: Ticket) => item.id === selectedTicketId)) {
        setSelectedTicketId(nextTickets[0]?.id || "");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((item) => item.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    setTagDraft(selectedTicket?.tags?.join(", ") || "");
  }, [selectedTicket]);

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await fetch("/api/admin/tickets/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      await loadData();
    } finally {
      setIsSavingConfig(false);
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) return;
    const newItem: TicketConfigItem = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      enabled: true,
    };
    setConfig((prev) => ({ ...prev, categories: [...prev.categories, newItem] }));
    setNewCategoryName("");
  };

  const addNewTag = () => {
    if (!newTagName.trim()) return;
    const newItem: TicketConfigItem = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      enabled: true,
    };
    setConfig((prev) => ({ ...prev, tags: [...prev.tags, newItem] }));
    setNewTagName("");
  };

  const addNewAssignee = () => {
    if (!newAssigneeName.trim()) return;
    const newItem: TicketConfigItem = {
      id: `asgn-${Date.now()}`,
      name: newAssigneeName.trim(),
      enabled: true,
    };
    setConfig((prev) => ({ ...prev, assignees: [...prev.assignees, newItem] }));
    setNewAssigneeName("");
  };

  const deleteConfigItem = (type: "categories" | "tags" | "assignees", id: string) => {
    setConfig((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== id),
    }));
  };

  const updateTicket = async (patch: Partial<Ticket>) => {
    if (!selectedTicket) {
      return;
    }

    setIsUpdatingTicket(true);
    try {
      await fetch(`/api/admin/tickets/${encodeURIComponent(selectedTicket.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadData();
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) {
      return;
    }

    setIsSendingReply(true);
    try {
      await fetch(`/api/admin/tickets/${encodeURIComponent(selectedTicket.id)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      setReply("");
      await loadData();
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tickets</h2>
          <p className="text-sm text-gray-500">Monitor pilot tickets and manage categories, tags and assignees.</p>
        </div>
        <Button variant="outline" onClick={() => loadData()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ticket configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <div className="font-medium text-gray-900">Ticket system enabled</div>
              <div className="text-xs text-gray-500">Disable to block new ticket creation from the website.</div>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: Boolean(checked) }))} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">Categories</div>
              {config.categories.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const next = [...config.categories];
                      next[index] = { ...item, name: e.target.value };
                      setConfig((prev) => ({ ...prev, categories: next }));
                    }}
                  />
                  <Switch
                    checked={Boolean(item.enabled)}
                    onCheckedChange={(checked) => {
                      const next = [...config.categories];
                      next[index] = { ...item, enabled: Boolean(checked) };
                      setConfig((prev) => ({ ...prev, categories: next }));
                    }}
                  />
                  <button
                    className="text-red-400 hover:text-red-600"
                    onClick={() => deleteConfigItem("categories", item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category..."
                  onKeyDown={(e) => e.key === "Enter" && addNewCategory()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewCategory}
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">Tags</div>
              {config.tags.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const next = [...config.tags];
                      next[index] = { ...item, name: e.target.value };
                      setConfig((prev) => ({ ...prev, tags: next }));
                    }}
                  />
                  <Switch
                    checked={Boolean(item.enabled)}
                    onCheckedChange={(checked) => {
                      const next = [...config.tags];
                      next[index] = { ...item, enabled: Boolean(checked) };
                      setConfig((prev) => ({ ...prev, tags: next }));
                    }}
                  />
                  <button
                    className="text-red-400 hover:text-red-600"
                    onClick={() => deleteConfigItem("tags", item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag..."
                  onKeyDown={(e) => e.key === "Enter" && addNewTag()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewTag}
                  disabled={!newTagName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-700">Assignees</div>
              {config.assignees.length === 0 && !newAssigneeName ? (
                <div className="text-sm text-gray-500">No assignees configured</div>
              ) : (
                config.assignees.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => {
                        const next = [...config.assignees];
                        next[index] = { ...item, name: e.target.value };
                        setConfig((prev) => ({ ...prev, assignees: next }));
                      }}
                    />
                    <Switch
                      checked={Boolean(item.enabled)}
                      onCheckedChange={(checked) => {
                        const next = [...config.assignees];
                        next[index] = { ...item, enabled: Boolean(checked) };
                        setConfig((prev) => ({ ...prev, assignees: next }));
                      }}
                    />
                    <button
                      className="text-red-400 hover:text-red-600"
                      onClick={() => deleteConfigItem("assignees", item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-2">
                <Input
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  placeholder="New assignee..."
                  onKeyDown={(e) => e.key === "Enter" && addNewAssignee()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewAssignee}
                  disabled={!newAssigneeName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={isSavingConfig} className="bg-[#E31E24] hover:bg-[#c91a1f]">
              {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ticket queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[640px] overflow-auto">
            {isLoading ? (
              <div className="text-sm text-gray-500 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="text-sm text-gray-500">No tickets found.</div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  className={`w-full text-left rounded-lg border p-3 hover:bg-gray-50 ${selectedTicketId === ticket.id ? "border-[#E31E24] bg-red-50/40" : "border-gray-200"}`}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm text-gray-900 truncate">#{ticket.number} {ticket.subject}</div>
                    {ticket.unreadByStaff > 0 ? <Badge className="bg-[#E31E24]">{ticket.unreadByStaff}</Badge> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <Badge variant="outline" className={statusBadgeClass[ticket.status]}>{ticket.status}</Badge>
                    <span className="text-gray-400">{formatDateTime(ticket.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-8 border-none shadow-sm">
          {selectedTicket ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">#{selectedTicket.number} {selectedTicket.subject}</CardTitle>
                    <div className="text-sm text-gray-500 mt-1">{selectedTicket.owner?.name || "Pilot"} ({selectedTicket.owner?.username || "unknown"})</div>
                  </div>
                  <Badge variant="outline" className={statusBadgeClass[selectedTicket.status]}>{selectedTicket.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select value={selectedTicket.status} onValueChange={(value) => updateTicket({ status: value as Ticket["status"] })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">open</SelectItem>
                      <SelectItem value="in_progress">in_progress</SelectItem>
                      <SelectItem value="resolved">resolved</SelectItem>
                      <SelectItem value="closed">closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.priority} onValueChange={(value) => updateTicket({ priority: value as Ticket["priority"] })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">low</SelectItem>
                      <SelectItem value="normal">normal</SelectItem>
                      <SelectItem value="high">high</SelectItem>
                      <SelectItem value="critical">critical</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.categoryId} onValueChange={(value) => updateTicket({ categoryId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.categories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTicket.assigneeId || "none"} onValueChange={(value) => updateTicket({ assigneeId: value === "none" ? null : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {config.assignees.filter((item) => Boolean(item.enabled)).map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder="Ticket tags (comma-separated)"
                  />
                  <Button
                    variant="outline"
                    disabled={isUpdatingTicket}
                    onClick={() => {
                      const nextTags = tagDraft
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean);
                      updateTicket({ tags: nextTags });
                    }}
                  >
                    Apply tags
                  </Button>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3 max-h-[320px] overflow-auto">
                  {selectedTicket.messages.map((msg) => (
                    <div key={msg.id} className={`rounded-lg border p-3 ${msg.authorRole === "staff" ? "border-sky-200 bg-sky-50" : "border-gray-200 bg-white"}`}>
                      <div className="text-xs text-gray-500 flex items-center justify-between">
                        <span>{msg.authorName} ({msg.authorRole})</span>
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{msg.content}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as staff" rows={4} />
                  <Button onClick={sendReply} disabled={isSendingReply || isUpdatingTicket} className="bg-[#E31E24] hover:bg-[#c91a1f]">
                    {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    Send reply
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="min-h-[500px] flex items-center justify-center text-gray-500">
              Select a ticket to moderate.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
