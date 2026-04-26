import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type NotificationCategory = "booking" | "claim" | "review" | "notam" | "event" | "badge" | "system";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
}

interface CreateNotificationInput {
  category: NotificationCategory;
  title: string;
  description: string;
}

interface NotificationsContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (input: CreateNotificationInput) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  deleteAllNotifications: () => void;
}

const NOTIFICATIONS_STORAGE_KEY = "nws.notifications.center";
const MAX_NOTIFICATIONS = 100;

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const loadStoredNotifications = (): NotificationItem[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && typeof item === "object");
  } catch {
    return [];
  }
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadStoredNotifications());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const value = useMemo<NotificationsContextType>(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.isRead).length,
    addNotification: ({ category, title, description }) => {
      setNotifications((current) => [
        {
          id:
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          category,
          title,
          description,
          createdAt: new Date().toISOString(),
          isRead: false,
        },
        ...current,
      ].slice(0, MAX_NOTIFICATIONS));
    },
    markAsRead: (notificationId) => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                isRead: true,
              }
            : item
        )
      );
    },
    markAllAsRead: () => {
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    },
    deleteNotification: (notificationId) => {
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    },
    deleteAllNotifications: () => {
      setNotifications([]);
    },
  }), [notifications]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }

  return context;
}