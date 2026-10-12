import { api } from "./client";

/** What can be reported from outside a chat. Messages keep their own endpoint. */
export type ReportTargetType = "user" | "parcel" | "trip" | "buddy_listing";

export type ReportReason = "spam" | "harassment" | "fraud" | "inappropriate" | "other";

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
}

export interface ReportResult {
  report_id: string;
  /** True when this person already reported the same target — nothing new was filed. */
  duplicate?: boolean;
}

export interface BlockList {
  /** People I blocked. */
  blocked_user_ids: string[];
  /** People who blocked me. Their content is hidden from me too — it is mutual. */
  blocked_by_user_ids: string[];
}

/**
 * User-generated-content moderation (App Store guideline 1.2): report any
 * listing or person, and block a person app-wide. Chat keeps its own
 * conversation-scoped block/report on `message-handler`.
 */
export const moderationApi = {
  report: (input: {
    target_type: ReportTargetType;
    target_id: string;
    reason: ReportReason;
    details?: string;
  }) => api.post<ReportResult>("/moderation-handler/report", input),

  getBlocks: () => api.get<BlockList>("/moderation-handler/blocks"),

  block: (userId: string) =>
    api.post<{ blocked: true }>("/moderation-handler/block", { user_id: userId }),

  unblock: (userId: string) =>
    api.delete<{ blocked: false }>(`/moderation-handler/block/${encodeURIComponent(userId)}`),
};
