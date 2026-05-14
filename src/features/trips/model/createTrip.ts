import type { Trip } from "@/types/models";

type TripDraftInput = {
  from: string;
  to: string;
  date: string;
  capacity: string;
};

export function createTripDraft(input: TripDraftInput): Trip {
  return {
    id: `trip-${Date.now()}`,
    from: input.from.trim(),
    to: input.to.trim(),
    date: input.date.trim(),
    capacity: input.capacity.trim(),
    offers: 0,
    earnings: "$0",
  };
}
