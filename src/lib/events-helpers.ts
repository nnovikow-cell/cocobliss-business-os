import { CATEGORY_COLORS } from "./checklist-colors";

export const TAG_COLORS = CATEGORY_COLORS;
export function tagColor(id: string | null | undefined) {
  return TAG_COLORS.find((c) => c.id === id) ?? TAG_COLORS[0];
}

export type Recurrence = "single" | "weekly" | "biweekly" | "monthly";
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  single: "Single",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

export type InstanceStatus = "confirmed" | "not_attending" | "cancelled";
export const INSTANCE_STATUS_LABEL: Record<InstanceStatus, string> = {
  confirmed: "Confirmed",
  not_attending: "Not attending",
  cancelled: "Cancelled",
};

export function staffShortName(s: { first_name: string | null; last_name: string | null; name: string }) {
  const f = (s.first_name ?? s.name ?? "").trim();
  const l = (s.last_name ?? "").trim();
  if (f && l) return `${f.charAt(0).toUpperCase()}. ${l}`;
  if (l) return l;
  return f || "—";
}