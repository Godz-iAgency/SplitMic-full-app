import { Zap } from "lucide-react";

type Props = {
  score: number;
  /** sm for cards, md for profile headers. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * The public Band Readiness Score pill — just the number, shown on cards and
 * profile headers. The full breakdown is private to the band (see
 * BandReadinessPanel).
 */
export function ReadinessBadge({ score, size = "sm", className = "" }: Props) {
  const sizing =
    size === "md"
      ? "gap-1.5 px-3 py-1 text-sm"
      : "gap-1 px-2 py-0.5 text-xs";
  const icon = size === "md" ? "h-4 w-4" : "h-3 w-3";

  return (
    <span
      title="Band Readiness Score"
      className={`inline-flex items-center rounded-full border border-brand-orange/40 bg-brand-orange/10 font-bold text-brand-orange ${sizing} ${className}`}
    >
      <Zap className={icon} strokeWidth={2.5} aria-hidden="true" />
      {score.toFixed(1)}
    </span>
  );
}
