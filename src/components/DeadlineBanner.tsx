"use client";

import { AlarmClock, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import {
  GFORM_DEADLINE,
  WEB_DEADLINE_OFFICIAL,
  EVOTE_START,
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

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

function computeParts(target: Date, now: Date): CountdownParts {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  }
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, past: false };
}

function CountdownUnit({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center min-w-[38px]">
      <span className={`text-xl sm:text-2xl font-bold ${color} tabular-nums leading-none`}>
        {String(value).padStart(2, "0")}
      </span>
      <span className={`text-[8px] uppercase tracking-wider ${color} opacity-70 mt-0.5`}>
        {label}
      </span>
    </div>
  );
}

function DeadlineCard({ label, date, sub, now, variant = "deadline", emoji }: DeadlineCardProps & { variant?: "deadline" | "event"; emoji?: string }) {
  const days = daysUntil(date, now);
  const u = urgency(days);
  const baseColor = URGENCY_COLOR[u];
  // For "event" variant (e.g. eVote start) use emerald instead of urgency-based color
  const color = variant === "event" ? URGENCY_COLOR.safe : baseColor;
  const parts = computeParts(date, now);
  const dateStr = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
  const timeStr = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    hour12: false,
  }) + " WIB";
  const pastLabel = variant === "event" ? "Sudah dimulai" : "Deadline lewat";

  return (
    <div className={`flex-1 min-w-0 rounded-lg border-2 ${color.border} ${color.bg} px-3 py-2.5`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${color.text}`}>
          {emoji ? `${emoji} ` : ""}{label}
        </span>
        <span className={`text-[9px] font-semibold ${color.text} tabular-nums`}>
          {dateStr} {timeStr}
        </span>
      </div>

      {parts.past ? (
        <p className={`text-lg font-bold ${color.text} tabular-nums leading-tight`}>
          {pastLabel}
        </p>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <CountdownUnit value={parts.days} label="hari" color={color.text} />
          <span className={`text-xl font-bold ${color.text} opacity-50`}>:</span>
          <CountdownUnit value={parts.hours} label="jam" color={color.text} />
          <span className={`text-xl font-bold ${color.text} opacity-50`}>:</span>
          <CountdownUnit value={parts.minutes} label="mnt" color={color.text} />
          <span className={`text-xl font-bold ${color.text} opacity-50`}>:</span>
          <CountdownUnit value={parts.seconds} label="dtk" color={color.text} />
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-1.5 leading-tight">{sub}</p>
    </div>
  );
}

/**
 * Countdown banner shown at the top of the dashboards. Ticks every second so
 * the seconds digit keeps moving — visual urgency.
 */
export default function DeadlineBanner() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlarmClock className="w-4 h-4 text-[#84303F]" />
          <h3 className="text-xs font-bold text-foreground">Timeline Munas XI</h3>
        </div>
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 animate-pulse" />
          live
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
          date={WEB_DEADLINE_OFFICIAL}
          sub="Selfie web di evote.ikastara.id"
          now={now}
        />
        <DeadlineCard
          label="3. eVote Munas"
          date={EVOTE_START}
          sub="Hari pemungutan suara dimulai"
          now={now}
          variant="event"
          emoji="🎉"
        />
      </div>
    </div>
  );
}
