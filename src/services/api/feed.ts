import { api } from "./client";

export interface FeedItem {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const feedApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    api.get<FeedItem[]>("/feed-handler/", params),
};
