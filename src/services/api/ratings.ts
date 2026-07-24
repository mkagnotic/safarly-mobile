import { api } from "./client";

/**
 * Server response shape — `rating-handler/users/{id}` joins the rater via
 * `user_profiles!ratings_author_id_fkey`, so each row in the response has
 * `author_id` (the FK column) and `user_profiles` (the joined object) —
 * NOT the canonical `rater_id` / `rater` names mobile screens read. We
 * normalize once here so screens can rely on `Rating.rater?.name` etc.
 *
 * Web's `CustomerReviews.tsx` reads `review.rater` directly — without this
 * normalize the rater shows up as "Anonymous" and the avatar fallback
 * always wins. Web has the same latent bug (its type also says `rater`);
 * mobile fixes it locally.
 */
interface RawRating {
  id: string;
  author_id?: string;
  rater_id?: string;
  rated_user_id: string;
  user_profiles?: { id?: string; name: string; avatar_url: string | null };
  rater?: { id?: string; name: string; avatar_url: string | null };
  [key: string]: unknown;
}

interface RawUserRatings {
  average_rating?: number;
  total_reviews?: number;
  total?: number;
  breakdown?: Record<string | number, number>;
  ratings?: RawRating[];
}

function normalizeRating(raw: RawRating): Rating {
  const rater = raw.rater ?? raw.user_profiles ?? undefined;
  return {
    ...raw,
    rater_id: raw.rater_id ?? raw.author_id ?? "",
    rater,
  } as unknown as Rating;
}

function normalizeUserRatings(raw: RawUserRatings | null | undefined): UserRatings {
  return {
    average_rating: raw?.average_rating ?? 0,
    breakdown: raw?.breakdown ?? {},
    ratings: (raw?.ratings ?? []).map(normalizeRating),
    total: typeof raw?.total === "number" ? raw.total : (raw?.total_reviews ?? 0),
  };
}

export interface Rating {
  id: string;
  booking_id: string | null;
  connection_id: string | null;
  rater_id: string;
  rated_user_id: string;
  type: string;
  score: number;
  review: string | null;
  created_at: string;
  updated_at: string;
  rater?: { id?: string; name: string; avatar_url: string | null };
}

export interface UserRatings {
  average_rating: number;
  breakdown: Record<string | number, number>;
  ratings: Rating[];
  total: number;
}

export const ratingsApi = {
  rateDelivery: (data: {
    booking_id: string;
    rated_user_id: string;
    score: number;
    review?: string;
  }) => api.post<Rating>("/rating-handler/", data),

  rateBuddy: (data: {
    connection_id: string;
    rated_user_id: string;
    score: number;
    review?: string;
  }) => api.post<Rating>("/rating-handler/buddy", data),

  getUserRatings: async (
    userId: string,
    params?: { page?: number; per_page?: number; role?: "received" | "given" },
  ) => {
    const res = await api.get<UserRatings>(`/rating-handler/users/${userId}`, params);
    if (res.data) {
      res.data = normalizeUserRatings(res.data as unknown as RawUserRatings);
    }
    return res;
  },

  update: (id: string, data: { score: number; review?: string }) =>
    api.put<Rating>(`/rating-handler/${id}`, data),

  delete: (id: string) => api.delete<{ deleted: boolean }>(`/rating-handler/${id}`),
};
