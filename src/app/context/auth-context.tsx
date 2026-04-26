import React, { createContext, useContext, useState, useEffect } from "react";

interface Pilot {
  id: string;
  callsign: string;
  firstName: string;
  lastName: string;
  email: string;
  rank: string;
  honoraryRank?: string;
  rankImage: string;
  totalHours: number;
  totalFlights: number;
  joinDate: string;
  location: string;
  avatar?: string;
}

const resolveHonoraryRankLabel = (user: {
  honoraryRank?: string;
  honorary_rank_name?: string;
  honoraryRankName?: string;
  honorary_rank_label?: string;
  honoraryRankLabel?: string;
  honorary_rank?: {
    name?: string;
    title?: string;
    label?: string;
    code?: string;
  };
}) => {
  const directLabel = String(
    user?.honoraryRank ||
      user?.honorary_rank_name ||
      user?.honoraryRankName ||
      user?.honorary_rank_label ||
      user?.honoraryRankLabel ||
      user?.honorary_rank?.name ||
      user?.honorary_rank?.title ||
      user?.honorary_rank?.label ||
      user?.honorary_rank?.code ||
      ""
  ).trim();

  return directLabel || undefined;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isAdmin: boolean;
  pilot: Pilot | null;
  loginWithPilotApi: (returnTo?: string) => Promise<void>;
  loginWithVAMSYS: () => Promise<void>;
  loginWithDiscord: (returnTo?: string, intent?: "login" | "link") => Promise<void>;
  connectPilotApi: (returnTo?: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pilot, setPilot] = useState<Pilot | null>(null);

  const mapDiscordUserToPilot = (user: {
    id?: string;
    username?: string;
    globalName?: string;
    email?: string;
    avatar?: string;
    vamsysPilotId?: number | string;
    vamsysPilotName?: string;
    vamsysPilotUsername?: string;
    honoraryRank?: string;
    honorary_rank?: {
      name?: string;
      title?: string;
      label?: string;
      code?: string;
    };
  }): Pilot => {
    const displayName = String(user.vamsysPilotName || user.globalName || user.username || "Pilot").trim();
    const parts = displayName.split(" ").filter(Boolean);
    const firstName = parts[0] || displayName || "Pilot";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Member";
    const resolvedId = String(user.vamsysPilotId || user.id || "discord");
    const resolvedCallsign = String(user.vamsysPilotUsername || user.username || "DISCORD");

    return {
      id: resolvedId,
      callsign: resolvedCallsign,
      firstName,
      lastName,
      email: String(user.email || ""),
      rank: "Member",
      honoraryRank: resolveHonoraryRankLabel(user),
      rankImage: "",
      totalHours: 0,
      totalFlights: 0,
      joinDate: new Date().toISOString().slice(0, 10),
      location: "",
      avatar: user.avatar || undefined,
    };
  };

  const mapVamsysUserToPilot = (user: {
    id?: string;
    username?: string;
    name?: string;
    email?: string;
    rank?: string;
    hours?: number;
    flights?: number;
    joinedAt?: string;
    avatar?: string;
    honoraryRank?: string;
    honorary_rank_name?: string;
    honoraryRankName?: string;
    honorary_rank_label?: string;
    honoraryRankLabel?: string;
    honorary_rank?: {
      name?: string;
      title?: string;
      label?: string;
      code?: string;
    };
  }): Pilot => {
    const displayName = String(user.name || user.username || "Pilot").trim();
    const parts = displayName.split(" ").filter(Boolean);
    const firstName = parts[0] || displayName || "Pilot";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Member";

    return {
      id: String(user.id || "vamsys"),
      callsign: String(user.username || "NWS"),
      firstName,
      lastName,
      email: String(user.email || ""),
      rank: String(user.rank || "Member"),
      honoraryRank: resolveHonoraryRankLabel(user),
      rankImage: "",
      totalHours: Number(user.hours || 0) || 0,
      totalFlights: Number(user.flights || 0) || 0,
      joinDate: String(user.joinedAt || new Date().toISOString().slice(0, 10)),
      location: "",
      avatar: user.avatar || undefined,
    };
  };

  const isPlaceholderPilot = (pilot: Pilot) => {
    const name = `${pilot.firstName} ${pilot.lastName}`.trim().toLowerCase();
    const callsign = String(pilot.callsign || "").trim().toUpperCase();
    return (
      !pilot.firstName ||
      name.startsWith("vamsys") ||
      name === "nws member" ||
      callsign === "NWS" ||
      callsign === "VAMSYS"
    );
  };

  const tryResolvePilotFromRoster = async (basePilot: Pilot): Promise<Pilot | null> => {
    try {
      let response: Response | null = null;
      const endpoints = ["/api/auth/vamsys/roster-me", "/api/auth/vamsys/roster_me"];

      for (const endpoint of endpoints) {
        response = await fetch(endpoint, {
          credentials: "include",
        });
        if (response.ok) {
          break;
        }
      }

      if (!response || !response.ok) {
        return null;
      }

      const payload = await response.json();
      const matched = payload?.user;
      if (!matched) {
        return null;
      }

      const resolvedName = String(matched?.name || matched?.username || "Pilot").trim();
      const parts = resolvedName.split(" ").filter(Boolean);
      const firstName = parts[0] || basePilot.firstName || "Pilot";
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : basePilot.lastName || "Member";

      return {
        ...basePilot,
        id: String(matched?.id || basePilot.id),
        callsign: String(matched?.username || basePilot.callsign),
        firstName,
        lastName,
        email: String(matched?.email || basePilot.email || ""),
        rank: String(matched?.rank || basePilot.rank || "Member"),
        honoraryRank: resolveHonoraryRankLabel(matched) || basePilot.honoraryRank,
        totalHours: Number(matched?.hours || basePilot.totalHours || 0) || 0,
        totalFlights: Number(matched?.flights || basePilot.totalFlights || 0) || 0,
        joinDate: String(matched?.joinedAt || basePilot.joinDate || new Date().toISOString().slice(0, 10)),
      };
    } catch {
      return null;
    }
  };

  const refreshAuth = async () => {
    setIsAuthLoading(true);
    try {
      const vamsysResponse = await fetch("/api/auth/vamsys/me", {
        credentials: "include",
      });

      if (vamsysResponse.ok) {
        const payload = await vamsysResponse.json();
        let mappedPilot = mapVamsysUserToPilot(payload?.user || {});

        if (isPlaceholderPilot(mappedPilot)) {
          const resolvedPilot = await tryResolvePilotFromRoster(mappedPilot);
          if (resolvedPilot) {
            mappedPilot = resolvedPilot;
          }
        }

        setIsAuthenticated(true);
        setPilot(mappedPilot);
        setIsAdmin(Boolean(payload?.isAdmin));
        setIsAuthLoading(false);
        return;
      }

      const response = await fetch("/api/auth/discord/me", {
        credentials: "include",
      });

      if (response.ok) {
        const payload = await response.json();
        const mappedPilot = mapDiscordUserToPilot(payload?.user || {});
        setIsAuthenticated(true);
        setPilot(mappedPilot);
        setIsAdmin(Boolean(payload?.isAdmin));
        setIsAuthLoading(false);
        return;
      }
    } catch {
      // ignore network errors
    }
    setIsAuthenticated(false);
    setPilot(null);
    setIsAdmin(false);
    setIsAuthLoading(false);
  };

  // Run refresh on mount so pages know auth state quickly
  useEffect(() => {
    refreshAuth().catch(() => {
      setIsAuthLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithVAMSYS = async () => {
    window.location.href = "/api/auth/vamsys/login";
  };

  const loginWithPilotApi = async (returnTo?: string) => {
    const params = new URLSearchParams();
    params.set("intent", "login");
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    window.location.href = `/api/auth/pilot-api/connect?${params.toString()}`;
  };

  const loginWithDiscord = async (returnTo?: string, intent: "login" | "link" = "login") => {
    const params = new URLSearchParams();
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    params.set("intent", intent);
    const query = params.toString();
    window.location.href = query ? `/api/auth/discord/login?${query}` : "/api/auth/discord/login";
  };

  const connectPilotApi = async (returnTo?: string) => {
    const params = new URLSearchParams();
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    const query = params.toString();
    window.location.href = query ? `/api/auth/pilot-api/connect?${query}` : "/api/auth/pilot-api/connect";
  };

  const logout = () => {
    fetch("/api/auth/vamsys/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // ignore
    });

    fetch("/api/auth/discord/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // ignore
    });

    setIsAuthenticated(false);
    setIsAdmin(false);
    setPilot(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthLoading,
        isAdmin,
        pilot,
        loginWithPilotApi,
        loginWithVAMSYS,
        loginWithDiscord,
        connectPilotApi,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
