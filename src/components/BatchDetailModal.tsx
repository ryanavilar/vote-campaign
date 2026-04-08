"use client";

import { X } from "lucide-react";
import { formatNum } from "@/lib/format";
import type { BatchStats } from "@/components/BatchCard";
import { getFunnelSteps } from "@/components/BatchCard";

export function BatchDetailModal({
  batch,
  onClose,
}: {
  batch: BatchStats;
  onClose: () => void;
}) {
  const steps = getFunnelSteps(batch);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xl text-[#0B27BC]">
              TN{batch.angkatan}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatNum(batch.totalAlumni)} alumni
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Funnel */}
        <div className="flex flex-col gap-2 mb-5">
          {steps.map((step) => {
            const pct = batch.totalAlumni > 0
              ? Math.round((step.value / batch.totalAlumni) * 100)
              : 0;
            const barWidth = batch.totalAlumni > 0
              ? Math.max(0, (step.value / batch.totalAlumni) * 100)
              : 0;

            return (
              <div key={step.label} className="flex items-center gap-2.5">
                <span className="text-[11px] text-muted-foreground w-[70px] shrink-0">
                  {step.label}
                </span>
                <div className="flex-1 h-[18px] bg-[#f1f5f9] rounded overflow-hidden">
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
                  className="text-[11px] font-bold w-[65px] text-right shrink-0"
                  style={{ color: step.color }}
                >
                  {formatNum(step.value)} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>

        {/* Tim Sukses */}
        <div className="border-t border-border pt-4">
          <p className="text-[11px] text-muted-foreground mb-2">Tim Sukses</p>
          {batch.campaigners.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {batch.campaigners.map((c) => (
                <span
                  key={c.user_id}
                  className="text-[11px] bg-[#0B27BC]/10 text-[#0B27BC] px-2.5 py-1 rounded-full font-medium"
                >
                  {c.email.split("@")[0]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Belum ditugaskan
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
