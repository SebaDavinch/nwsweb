import { useCallback, useEffect, useState } from "react";

export interface ChatRoom {
  id: string;
  name: string;
  type: "public" | "private" | "dm";
  system?: boolean;
  isOwner?: boolean;
  memberCount?: number;
  dm?: boolean;
  peer?: string;
}

export interface CustomEmoji {
  name: string;
  url: string;
}

/**
 * Список доступных пользователю комнат чата + кастомные эмодзи.
 * Управление: создание (открытая/закрытая), приглашение по нику, удаление.
 */
export function useChatRooms() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pilot/chat/rooms", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.rooms)) setRooms(data.rooms);
      if (Array.isArray(data?.emojis)) setEmojis(data.emojis);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createRoom = useCallback(
    async (name: string, type: "public" | "private") => {
      const res = await fetch("/api/pilot/chat/rooms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      await refresh();
      return data?.room?.id ?? null;
    },
    [refresh]
  );

  const inviteToRoom = useCallback(
    async (roomId: string, username: string) => {
      const res = await fetch(`/api/pilot/chat/rooms/${encodeURIComponent(roomId)}/invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      return res.ok;
    },
    []
  );

  const openDm = useCallback(
    async (username: string) => {
      const res = await fetch("/api/pilot/chat/dm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      await refresh();
      return (data?.room?.id as string) ?? null;
    },
    [refresh]
  );

  const deleteRoom = useCallback(
    async (roomId: string) => {
      const res = await fetch(`/api/pilot/chat/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) await refresh();
      return res.ok;
    },
    [refresh]
  );

  return { rooms, emojis, loading, refresh, createRoom, inviteToRoom, deleteRoom, openDm };
}
