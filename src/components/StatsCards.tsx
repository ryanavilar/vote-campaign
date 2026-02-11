"use client";

import { Users, ClipboardCheck, Phone, UserCheck, Vote } from "lucide-react";

interface StatsProps {
  stats: {
    total: number;
    dptSudah: number;
    kontakSudah: number;
    grupSudah: number;
    voteSudah: number;
  };
}

export function StatsCards({ stats }: StatsProps) {
  const cards = [
    {
      label: "Total Anggota",
      value: stats.total,
      icon: Users,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
    },
    {
      label: "Status DPT",
      value: stats.dptSudah,
      sub: `${stats.total - stats.dptSudah} belum`,
      icon: ClipboardCheck,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-700",
      percentage: Math.round((stats.dptSudah / stats.total) * 100),
    },
    {
      label: "Sudah Dikontak",
      value: stats.kontakSudah,
      sub: `${stats.total - stats.kontakSudah} belum`,
      icon: Phone,
      color: "bg-amber-500",
      bgColor: "bg-amber-50",
      textColor: "text-amber-700",
      percentage: Math.round((stats.kontakSudah / stats.total) * 100),
    },
    {
      label: "Masuk Grup",
      value: stats.grupSudah,
      sub: `${stats.total - stats.grupSudah} belum`,
      icon: UserCheck,
      color: "bg-violet-500",
      bgColor: "bg-violet-50",
      textColor: "text-violet-700",
      percentage: Math.round((stats.grupSudah / stats.total) * 100),
    },
    {
      label: "Sudah Vote",
      value: stats.voteSudah,
      sub: `${stats.total - stats.voteSudah} belum`,
      icon: Vote,
      color: "bg-rose-500",
      bgColor: "bg-rose-50",
      textColor: "text-rose-700",
      percentage: Math.round((stats.voteSudah / stats.total) * 100),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
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
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              {card.label}
            </p>
            {card.percentage !== undefined && (
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
