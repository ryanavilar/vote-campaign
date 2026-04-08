"use client";

import { formatNum } from "@/lib/format";

export interface BatchStats {
  angkatan: number;
  totalAlumni: number;
  memberCount: number;
  hasPhone: number;
  contacted: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  grupWa: number;
  dpt: number;
  vote: number;
  campaigners: { user_id: string; email: string }[];
}

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

function getFunnelSteps(b: BatchStats): FunnelStep[] {
  return [
    { label: "Punya HP", value: b.hasPhone, color: "#0B27BC" },
    { label: "Kontak", value: b.contacted, color: "#3b82f6" },
    { label: "Dukung", value: b.dukung, color: "#10b981" },
    { label: "Ragu", value: b.ragu, color: "#eab308" },
    { label: "Sebelah", value: b.sebelah, color: "#ef4444" },
    { label: "Grup WA", value: b.grupWa, color: "#84303F" },
    { label: "DPT", value: b.dpt, color: "#6366f1" },
    { label: "Vote", value: b.vote, color: "#84303F" },
  ];
}

export { getFunnelSteps };

export function BatchCard({
  batch,
  onClick,
}: {
  batch: BatchStats;
  onClick: () => void;
}) {
  const steps = getFunnelSteps(batch);
  const picName = batch.campaigners.length > 0
    ? batch.campaigners[0].email.split("@")[0]
    : null;

  return (
    <div
      onClick={onClick}
      className="border border-border rounded-xl p-4 bg-white cursor-pointer transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-[#0B27BC]">
            TN{batch.angkatan}
          </span>
          {picName && (
            <span className="text-[11px] text-muted-foreground">
              PIC: {picName}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-[#0B27BC]">
          {formatNum(batch.totalAlumni)} alumni
        </span>
      </div>

      {/* Funnel rows */}
      <div className="flex flex-col gap-[5px]">
        {steps.map((step) => {
          const pct = batch.totalAlumni > 0
            ? Math.round((step.value / batch.totalAlumni) * 100)
            : 0;
          const barWidth = batch.totalAlumni > 0
            ? Math.max(0, (step.value / batch.totalAlumni) * 100)
            : 0;

          return (
            <div key={step.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-[60px] shrink-0 truncate">
                {step.label}
              </span>
              <div className="flex-1 h-[14px] bg-[#f1f5f9] rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: step.color,
                    minWidth: step.value > 0 ? "2px" : "0",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-semibold w-[58px] text-right shrink-0"
                style={{ color: step.color }}
              >
                {formatNum(step.value)} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
