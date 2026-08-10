import Link from "next/link";
import { Music } from "lucide-react";

type Props = {
  range: "today" | "week";
};

export function EmptyState({ range }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
      <Music className="h-8 w-8 text-brand-gray-400" aria-hidden="true" />
      <p className="text-base font-semibold text-white">
        No listed shows found for {range === "today" ? "tonight" : "this week"} yet
      </p>
      <p className="max-w-sm text-sm text-brand-gray-400">
        Austin&rsquo;s live music calendar updates daily — check back soon, or
        browse the{" "}
        <Link href="/directory" className="text-brand-orange hover:underline">
          directory of Austin bands and venues
        </Link>
        .
      </p>
    </div>
  );
}
