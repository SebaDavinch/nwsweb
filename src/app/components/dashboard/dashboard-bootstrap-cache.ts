import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "./dashboard-session-cache";

export interface DashboardBootstrapPayload {
  generatedAt?: string | null;
  fleets?: unknown[];
  airports?: unknown[];
  routes?: unknown[];
}

const dashboardBootstrapCache = createDashboardSessionCache<DashboardBootstrapPayload>(
  "nws.dashboard.bootstrap.v1",
  10 * 60 * 1000,
);

export const fetchDashboardBootstrap = async (options: { force?: boolean } = {}) =>
  fetchDashboardSessionCache(
    dashboardBootstrapCache,
    async () => {
      const response = await fetch("/api/vamsys/dashboard/bootstrap", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as DashboardBootstrapPayload | null;
      if (!response.ok) {
        throw new Error(String((payload as { error?: string } | null)?.error || "Failed to load dashboard bootstrap"));
      }
      return payload || {};
    },
    options,
  );

export const getCachedDashboardBootstrap = () => getDashboardSessionCache(dashboardBootstrapCache);