import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "../dashboard/dashboard-session-cache";

export interface AdminBootstrapPayload {
  generatedAt?: string | null;
  routes?: unknown[];
  hubs?: unknown[];
  airports?: unknown[];
  fleets?: unknown[];
  liveFleets?: unknown[];
  bookings?: unknown[];
  pilots?: unknown[];
  pireps?: {
    pireps?: unknown[];
    meta?: {
      next_cursor?: string | null;
    } | null;
  } | null;
}

const adminBootstrapCache = createDashboardSessionCache<AdminBootstrapPayload>(
  "nws.admin.bootstrap.v1",
  10 * 60 * 1000,
);

export const fetchAdminBootstrap = async (options: { force?: boolean } = {}) =>
  fetchDashboardSessionCache(
    adminBootstrapCache,
    async () => {
      const search = options.force ? "?force=1" : "";
      const response = await fetch(`/api/admin/bootstrap${search}`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as AdminBootstrapPayload | null;
      if (!response.ok) {
        throw new Error(String((payload as { error?: string } | null)?.error || "Failed to load admin bootstrap"));
      }
      return payload || {};
    },
    options,
  );

export const getCachedAdminBootstrap = () => getDashboardSessionCache(adminBootstrapCache);