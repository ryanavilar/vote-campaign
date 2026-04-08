"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, GraduationCap, ThumbsUp, Vote, Layers } from "lucide-react";
import { formatNum } from "@/lib/format";
import { BatchCard } from "@/components/BatchCard";
import { BatchDetailModal } from "@/components/BatchDetailModal";
import type { BatchStats } from "@/components/BatchCard";

export function BatchProgressTab() {
  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/alumni/stats/per-batch");
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch {
      // silent fail — empty state shown
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#0B27BC]" />
      </div>
    );
  }

  const totalAlumni = batches.reduce((s, b) => s + b.totalAlumni, 0);
  const totalDukung = batches.reduce((s, b) => s + b.dukung, 0);
  const totalVote = batches.reduce((s, b) => s + b.vote, 0);

  const summaryCards = [
    { label: "Total Batch", value: batches.length, icon: Layers, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
    { label: "Total Alumni", value: totalAlumni, icon: GraduationCap, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
    { label: "Total Dukung", value: totalDukung, icon: ThumbsUp, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Total Vote", value: totalVote, icon: Vote, color: "text-[#84303F]", bg: "bg-[#84303F]/10" },
  ];

  return (
    <>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-border p-3 shadow-sm text-center"
            >
              <div className={`inline-flex p-1.5 rounded-lg ${card.bg} mb-1`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground leading-tight">
                {formatNum(card.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Batch cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {batches.map((batch) => (
          <BatchCard
            key={batch.angkatan}
            batch={batch}
            onClick={() => setSelectedBatch(batch)}
          />
        ))}
      </div>

      {/* Detail modal */}
      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </>
  );
}
