"use client";

interface EngagementBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function getLevel(score: number): {
  label: string;
  bgClass: string;
  textClass: string;
} {
  if (score >= 11) {
    return {
      label: "Super Aktif",
      bgClass: "bg-amber-100",
      textClass: "text-amber-700",
    };
  }
  if (score >= 7) {
    return {
      label: "Setia",
      bgClass: "bg-emerald-100",
      textClass: "text-emerald-700",
    };
  }
  if (score >= 3) {
    return {
      label: "Aktif",
      bgClass: "bg-[#0B27BC]/10",
      textClass: "text-[#0B27BC]",
    };
  }
  return {
    label: "Baru",
    bgClass: "bg-gray-100",
    textClass: "text-gray-600",
  };
}

export function EngagementBadge({ score, size = "md" }: EngagementBadgeProps) {
  const { label, bgClass, textClass } = getLevel(score);

  const sizeClasses =
    size === "sm" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${bgClass} ${textClass} ${sizeClasses}`}
    >
      {label}
      <span className="opacity-60">({score})</span>
    </span>
  );
}
