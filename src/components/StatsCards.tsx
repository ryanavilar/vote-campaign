"use client";

import { Users, ClipboardCheck, GraduationCap, Smartphone, Vote } from "lucide-react";
import { formatNum } from "@/lib/format";

interface StatsProps {
  stats: {
    total: number;
    totalAlumni: number;
    linkedAlumni: number;
    dptSudah: number;
    grupSudah: number;
    grupLinked?: number;
    grupUnlinked?: number;
    totalInGroup?: number;
    voteSudah: number;
  };
  alumniLoaded?: boolean;
}

export function StatsCards({ stats, alumniLoaded = true }: StatsProps) {
  const safePercent = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;

  const grupSub = stats.totalInGroup !== undefined
    ? `${formatNum(stats.grupLinked || 0)} linked · ${formatNum(stats.grupUnlinked || 0)} unlinked`
    : `${formatNum(stats.total - stats.grupSudah)} belum`;

  const cards = [
    {
      label: "Data Alumni",
      value: stats.totalAlumni,
      sub: `${formatNum(stats.linkedAlumni)} terhubung`,
      icon: GraduationCap,
      color: "bg-[#84303F]",
      bgColor: "bg-[#84303F]/10",
      textColor: "text-[#84303F]",
      percentage: safePercent(stats.linkedAlumni, stats.totalAlumni),
      isAlumni: true,
    },
    {
      label: "Total Anggota",
      value: stats.total,
      icon: Users,
      color: "bg-[#0B27BC]",
      bgColor: "bg-[#0B27BC]/10",
      textColor: "text-[#0B27BC]",
    },
    {
      label: "Masuk Grup WA",
      value: stats.grupSudah,
      sub: grupSub,
      icon: Smartphone,
      color: "bg-[#0B27BC]",
      bgColor: "bg-[#0B27BC]/10",
      textColor: "text-[#0B27BC]",
      percentage: safePercent(stats.grupSudah, stats.total),
    },
    {
      label: "Status DPT",
      value: stats.dptSudah,
      sub: `${formatNum(stats.total - stats.dptSudah)} belum`,
      icon: ClipboardCheck,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-700",
      percentage: safePercent(stats.dptSudah, stats.total),
    },
    {
      label: "Sudah Vote",
      value: stats.voteSudah,
      sub: `${formatNum(stats.total - stats.voteSudah)} belum`,
      icon: Vote,
      color: "bg-[#84303F]",
      bgColor: "bg-[#84303F]/10",
      textColor: "text-[#84303F]",
      percentage: safePercent(stats.voteSudah, stats.total),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isLoading = "isAlumni" in card && card.isAlumni && !alumniLoaded;

        if (isLoading) {
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-border p-4 shadow-sm animate-pulse"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-5 h-5 ${card.textColor}`} />
                </div>
              </div>
              <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
              <p className="text-xs font-medium text-muted-foreground mt-1">{card.label}</p>
              <div className="mt-2">
                <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                <div className="w-full h-1.5 bg-gray-100 rounded-full" />
              </div>
            </div>
          );
        }

        return (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNum(card.value)}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              {card.label}
            </p>
            {"percentage" in card && card.percentage !== undefined && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={card.textColor}>{card.percentage}%</span>
                  <span className="text-muted-foreground">{card.sub}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${card.color} transition-all duration-500`}
                    style={{ width: `${card.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
