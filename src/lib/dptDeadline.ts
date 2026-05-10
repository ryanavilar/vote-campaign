/**
 * DPT registration deadlines for Munas XI IKASTARA.
 *
 * Flow: GForm → sync harian → website selfie → verifikator approve → status_dpt Sudah.
 *
 * Dashboard UI uses an EFFECTIVE website deadline 1 day earlier than the
 * official one so the verifikator still has buffer. eVote starts 2026-05-16.
 */
export const GFORM_DEADLINE = new Date("2026-05-10T23:59:00+07:00");
export const WEB_DEADLINE_OFFICIAL = new Date("2026-05-12T23:59:00+07:00");
export const EVOTE_START = new Date("2026-05-16T01:00:00+07:00");

export type DptTier =
  | "aman"
  | "pending_verifikator"
  | "perlu_web"
  | "perlu_gform"
  | "hilang";

export const TIER_LABEL: Record<DptTier, string> = {
  aman: "Aman",
  pending_verifikator: "Pending Verifikator",
  perlu_web: "Perlu Selfie Web",
  perlu_gform: "Perlu GForm",
  hilang: "Hilang",
};

export const TIER_SUB: Record<DptTier, string> = {
  aman: "Sudah sah DPT",
  pending_verifikator: "Selfie ✓, nunggu verifikator",
  perlu_web: "GForm ✓, blm selfie web",
  perlu_gform: "Belum isi GForm",
  hilang: "Deadline lewat, blm selfie",
};

export interface DptFlags {
  isi_form_dpt?: string | null;
  registrasi_website_dpt?: string | null;
  status_dpt?: string | null;
}

/**
 * Classifies a pendukung (or any alumni) by their current registration state.
 * `now` lets callers test deterministically; defaults to wall clock.
 */
export function classifyTier(m: DptFlags, now: Date = new Date()): DptTier {
  const form = m.isi_form_dpt === "Sudah";
  const web = m.registrasi_website_dpt === "Sudah";
  const sah = m.status_dpt === "Sudah";
  if (sah) return "aman";
  if (web) return "pending_verifikator";
  if (form) return "perlu_web";
  if (now.getTime() > WEB_DEADLINE_OFFICIAL.getTime()) return "hilang";
  return "perlu_gform";
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function hoursUntil(target: Date, now: Date = new Date()): number {
  const diffMs = target.getTime() - now.getTime();
  return Math.floor(diffMs / (60 * 60 * 1000));
}

export type DeadlineUrgency = "safe" | "warn" | "urgent" | "critical" | "past";

export function urgency(days: number): DeadlineUrgency {
  if (days < 0) return "past";
  if (days <= 2) return "critical";
  if (days <= 5) return "urgent";
  if (days <= 10) return "warn";
  return "safe";
}

export const URGENCY_COLOR: Record<
  DeadlineUrgency,
  { bg: string; border: string; text: string; bar: string }
> = {
  safe: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  warn: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    bar: "bg-yellow-500",
  },
  urgent: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    bar: "bg-orange-500",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    bar: "bg-red-500",
  },
  past: {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-600",
    bar: "bg-gray-400",
  },
};
