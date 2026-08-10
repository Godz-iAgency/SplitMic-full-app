import Link from "next/link";
import { Search, BookOpen } from "lucide-react";

type Props =
  | { mode: "unbuilt"; plural: string }
  | { mode: "no-results"; plural: string; query: string; clearHref: string };

export function DirectoryEmptyState(props: Props) {
  if (props.mode === "no-results") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
        <Search className="h-8 w-8 text-brand-gray-400" aria-hidden="true" />
        <p className="text-base font-semibold text-white">
          No {props.plural.toLowerCase()} match &ldquo;{props.query}&rdquo;
        </p>
        <Link
          href={props.clearHref}
          className="text-sm font-semibold text-brand-orange hover:underline"
        >
          Clear search
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
      <BookOpen className="h-8 w-8 text-brand-gray-400" aria-hidden="true" />
      <p className="text-base font-semibold text-white">
        We&rsquo;re still building out the {props.plural.toLowerCase()} section
      </p>
      <p className="max-w-sm text-sm text-brand-gray-400">
        Know one that belongs here?{" "}
        <Link href="/support" className="text-brand-orange hover:underline">
          Tell us about it
        </Link>
        .
      </p>
    </div>
  );
}
