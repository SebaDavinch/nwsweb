import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { AdminContentManager } from "./admin-content-manager";

interface StaffItem {
  id: string;
  pilotId?: number | null;
  username?: string;
  name: string;
  role: string;
  rank?: string;
  division: string;
  status: string;
  email: string;
  discord?: string;
  syncedAt?: string;
  bio?: string;
  order?: number;
  source?: string;
}

export function AdminStaff() {
  const location = useLocation();
  const [reloadToken, setReloadToken] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const autoSyncTriggeredRef = useRef(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/admin/staff/sync", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to sync staff");
      }

      const payload = await response.json().catch(() => null);

      setReloadToken((current) => current + 1);
      toast.success(
        payload?.stats
          ? `Staff sync complete: ${Number(payload.stats.synced || 0)} synced, ${Number(payload.stats.archived || 0)} archived`
          : "Staff sync complete"
      );
    } catch (error) {
      console.error("Failed to sync staff", error);
      toast.error("Failed to sync staff");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoSync = params.get("sync") === "1";

    if (!shouldAutoSync) {
      autoSyncTriggeredRef.current = false;
      return;
    }

    if (autoSyncTriggeredRef.current || isSyncing) {
      return;
    }

    autoSyncTriggeredRef.current = true;
    handleSync().catch(() => undefined);
  }, [isSyncing, location.search]);

  return (
    <AdminContentManager<StaffItem>
      collection="staff"
      title="VA Staff"
      subtitle="Maintain staff roster and pull current VA staff from vAMSYS with synced pilot ranks."
      singularLabel="Staff Member"
      searchKeys={["name", "username", "role", "rank", "division", "email", "discord", "pilotId"]}
      filterKeys={["division", "rank", "status", "source"]}
      reloadToken={reloadToken}
      toolbarActions={
        <Button type="button" variant="outline" onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync from vAMSYS
        </Button>
      }
      columns={[
        { key: "name", label: "Name" },
        { key: "username", label: "Username" },
        { key: "role", label: "Role" },
        { key: "rank", label: "Rank" },
        { key: "division", label: "Division" },
        { key: "discord", label: "Discord" },
        {
          key: "status",
          label: "Status",
          render: (item) => <Badge variant="outline">{item.status || "active"}</Badge>,
        },
        {
          key: "source",
          label: "Source",
          render: (item) => <Badge variant="outline">{item.source || "manual"}</Badge>,
        },
        {
          key: "syncedAt",
          label: "Last Sync",
          render: (item) => {
            const value = String(item.syncedAt || "").trim();
            if (!value) {
              return "—";
            }

            const timestamp = Date.parse(value);
            return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value;
          },
        },
        { key: "email", label: "Email" },
      ]}
      fields={[
        { key: "pilotId", label: "Pilot ID", type: "number" },
        { key: "username", label: "Username", type: "text" },
        { key: "name", label: "Name", type: "text" },
        { key: "role", label: "Role", type: "text" },
        { key: "rank", label: "Rank", type: "text" },
        { key: "division", label: "Division", type: "text" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "On leave", value: "leave" },
            { label: "Archived", value: "archived" },
          ],
        },
        { key: "email", label: "Email", type: "text" },
        { key: "discord", label: "Discord", type: "text" },
        {
          key: "source",
          label: "Source",
          type: "select",
          options: [
            { label: "Manual", value: "manual" },
            { label: "vAMSYS", value: "vamsys" },
          ],
        },
        { key: "syncedAt", label: "Last Sync", type: "text" },
        { key: "order", label: "Order", type: "number" },
        { key: "bio", label: "Bio", type: "textarea" },
      ]}
    />
  );
}