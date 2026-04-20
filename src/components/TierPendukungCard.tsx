"use client";

import { ShieldCheck, Clock, Camera, FileText, Ban, AlarmClock } from "lucide-react";
import type { DptTier } from "@/lib/dptDeadline";
import { TIER_LABEL, TIER_SUB } from "@/lib/dptDeadline";
import { formatNum } from "@/lib/format";

type TierCounts = Record<DptTier, number>;

interface TierPendukungCardProps {
  tiers: TierCounts;
  pendukungTotal: number;
  title?: string;
  subtitle?: string;
}

const TIER_ORDER: DptTier[] = ["aman", "pending_verifikator", "perlu_web", "perlu_gform", "hilang"];

const TIER_STYLE: Record<
  DptTier,
  { bg: string; border: string; text: string; bar: string; icon: typeof ShieldCheck }
> = {
  aman: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
    icon: ShieldCheck,
  },
  pending_verifikator: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    bar: "bg-yellow-500",
    icon: Clock,
  },
  perlu_web: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    bar: "bg-orange-500",
    icon: Camera,
  },
  perlu_gform: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    bar: "bg-red-500",
    icon: FileText,
  },
  hilang: {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-600",
    bar: "bg-gray-400",
    icon: Ban,
  },
};

export default function TierPendukungCard({
  tiers,
  pendukungTotal,
  title = "Tier Pendukung Kita",
  subtitle,
}: TierPendukungCardProps) {
  const pct = (n: number) => (pendukungTotal > 0 ? (n / pendukungTotal) * 100 : 0);
  const beresiko = tiers.perlu_web + tiers.perlu_gform + tiers.hilang;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlarmClock className="w-5 h-5 text-[#84303F]" />
          <h3 className="text-base font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {formatNum(pendukungTotal)} pendukung
        </p>
      </div>

      {subtitle && (
        <p className="text-[11px] text-muted-foreground leading-tight">{subtitle}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TIER_ORDER.map((t) => {
          const style = TIER_STYLE[t];
          const count = tiers[t] || 0;
          const Icon = style.icon;
          const p = Math.round(pct(count));
          return (
            <div key={t} className={`rounded-lg border ${style.border} ${style.bg} p-2.5`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>
                  {TIER_LABEL[t]}
                </p>
              </div>
              <p className={`text-xl font-bold ${style.text} tabular-nums leading-tight`}>
                {formatNum(count)}
              </p>
              <p className={`text-[9px] font-semibold ${style.text}`}>{p}%</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                {TIER_SUB[t]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Beresiko kehilangan suara (butuh tindakan):
          </p>
          <p className="text-sm font-bold text-[#84303F] tabular-nums">
            {formatNum(beresiko)}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              ({pendukungTotal > 0 ? Math.round(pct(beresiko)) : 0}%)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
