import type { AppTimeFormat, AppTimeZone } from "@/features/profile/preferencesConfig";

const CLOCK_REGEX = /^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/;

function pad2(value: number): string {
  return `${value}`.padStart(2, "0");
}

export function formatClockLabel(raw: string, format: AppTimeFormat): string {
  const normalized = raw.trim();
  const match = CLOCK_REGEX.exec(normalized);
  if (!match) return raw;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const suffix = match[3]?.toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return raw;
  }

  if (format === "24h") {
    if (!suffix) return `${pad2(hours)}:${pad2(minutes)}`;
    const base = hours % 12;
    const converted = suffix === "PM" ? base + 12 : base;
    return `${pad2(converted)}:${pad2(minutes)}`;
  }

  if (suffix) {
    return `${hours}:${pad2(minutes)} ${suffix}`;
  }
  const safe24h = Math.max(0, Math.min(23, hours));
  const suffix12 = safe24h >= 12 ? "PM" : "AM";
  const base12 = safe24h % 12;
  const converted = base12 === 0 ? 12 : base12;
  return `${converted}:${pad2(minutes)} ${suffix12}`;
}

export function nowClockLabel(format: AppTimeFormat, timeZone: AppTimeZone): string {
  const hour12 = format === "12h";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(new Date());
}
