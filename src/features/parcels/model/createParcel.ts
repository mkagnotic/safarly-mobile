import type { Parcel } from "@/types/models";

type CreateParcelInput = {
  from: string;
  to: string;
  weight: string;
  fee: string;
  category: string;
  sender?: string;
};

export function buildParcelId(): string {
  return `PKG-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function normalizeFee(fee: string): string {
  const value = fee.trim();
  if (!value) return "$0";
  return value.startsWith("$") ? value : `$${value}`;
}

export function formatParcelDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function createParcelDraft(input: CreateParcelInput): Parcel {
  return {
    id: buildParcelId(),
    from: input.from.trim(),
    to: input.to.trim(),
    weight: input.weight.trim(),
    fee: normalizeFee(input.fee),
    date: formatParcelDate(),
    category: input.category.trim(),
    sender: input.sender ?? "Alex Johnson",
    status: "open",
    desc: "Submitted from mobile app",
  };
}
