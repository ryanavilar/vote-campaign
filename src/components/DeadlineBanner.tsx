"use client";

import { AlarmClock, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import {
  GFORM_DEADLINE,
  WEB_DEADLINE_EFFECTIVE,
  WEB_DEADLINE_OFFICIAL,
  daysUntil,
  urgency,
  URGENCY_COLOR,
} from "@/lib/dptDeadline";

interface DeadlineCardProps {
  label: string;
  date: Date;
  sub: string;
  now: Date;
}

function DeadlineCard({ label, date, sub, now }: DeadlineCardProps) {
  const days = daysUntil(date, now);
  const u = urgency(days);
  const color = URGENCY_COLOR[u];
  const dateStr = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div className={`flex-1 min-w-0 rounded-lg border ${color.border} ${color.bg} px-3 py-2`}>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${color.text}`}>
          {label}
        </span>
        <span className={`text-[10px] font-semibold ${color.text} tabular-nums`}>
          {days > 0 ? `${days} hari lg` : days === 0 ? "hari ini" : "lewat"}
        </span>
      </div>
      <p className={`text-sm font-bold ${color.text} tabular-nums leading-tight`}>{dateStr}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>
    </div>
  );
}

/**
 * Three-stage countdown banner shown at the top of the dashboards.
 * Ticks every minute so the day counter stays correct.
 */
export default function DeadlineBanner() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlarmClock className="w-4 h-4 text-[#84303F]" />
          <h3 className="text-xs font-bold text-foreground">Deadline DPT Munas XI</h3>
        </div>
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          update tiap menit
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <DeadlineCard
          label="1. GForm"
          date={GFORM_DEADLINE}
          sub="Isi form pendaftaran"
          now={now}
        />
        <DeadlineCard
          label="2. Selfie Web"
          date={WEB_DEADLINE_EFFECTIVE}
          sub="Batas aman (verifikator butuh 1 hari)"
          now={now}
        />
      </div>
      <p className="text-[9px] text-muted-foreground leading-tight">
        Deadline resmi selfie web: {WEB_DEADLINE_OFFICIAL.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} 23:59 WIB — dashboard pakai 1 hari lebih awal biar verifikator sempet.
      </p>
    </div>
  );
}
