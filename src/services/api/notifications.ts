import { api } from "./client";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: { link?: string; [key: string]: unknown } | null;
  read: boolean;
  created_at: string;
}

interface RawNotification {
  read_at?: string | null;
  read?: boolean;
  [key: string]: unknown;
}

export const notificationsApi = {
  /** Server returns `read_at`; normalize to a simple `read` boolean. */
  list: async (params?: { page?: number; per_page?: number }) => {
    const result = await api.get<RawNotification[]>("/notification-handler/", params);
    if (Array.isArray(result.data)) {
      result.data = result.data.map((n) => ({
        ...n,
        read: !!(n.read_at ?? n.read),
      }));
    }
    return result as unknown as { data: Notification[]; meta?: { total: number } };
  },

  getUnreadCount: () =>
    api.get<{ unread_count: number }>("/notification-handler/unread-count"),

  markAsRead: (id: string) => api.put<{ read: boolean }>(`/notification-handler/${id}/read`),

  markAllAsRead: () => api.put<{ read_all: boolean }>("/notification-handler/read-all"),

  adminBroadcast: (title: string, body: string, type?: string) =>
    api.post<{ sent_to: number }>("/notification-handler/admin/broadcast", {
      title,
      body,
      type: type ?? "system",
    }),

  registerPushToken: (token: string, platform: "ios" | "android" | "web") =>
    api.post<{ registered: boolean }>("/user-handler/me/push-token", { token, platform }),

  removePushToken: (token: string) =>
    api.delete<{ removed: boolean }>(
      `/user-handler/me/push-token?token=${encodeURIComponent(token)}`,
    ),
};
