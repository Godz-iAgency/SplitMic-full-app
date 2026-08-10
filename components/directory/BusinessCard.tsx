import Link from "next/link";
import { ExternalLink, Phone, Star, Sparkles, BadgeCheck } from "lucide-react";
import type { DirectoryCard } from "@/lib/directory/queries";
import { CATEGORY_META } from "@/lib/directory/categories";
import { DirectoryCategoryIcon } from "./DirectoryCategoryIcon";

/**
 * Three visually distinct treatments by tier. This is what makes the page read
 * as a curated guide rather than a dumped list — a spotlight listing should be
 * unmistakable at a glance, not just first in the sort order.
 */
export function BusinessCard({ card }: { card: DirectoryCard }) {
  if (card.tier === "spotlight") return <SpotlightCard card={card} />;
  return <GridCard card={card} />;
}

function SpotlightCard({ card }: { card: DirectoryCard }) {
  return (
    <article
      data-business-card={card.id}
      data-tier="spotlight"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-orange/20 via-brand-gray-900 to-black p-[1.5px]"
    >
      <div className="rounded-[calc(1rem-1px)] bg-gradient-to-br from-brand-gray-900 to-black p-5 sm:p-6">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange">
          <Star className="h-3.5 w-3.5 fill-brand-orange" aria-hidden="true" />
          Spotlight
        </div>

        <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
          {card.businessName}
        </h3>

        <MetaRow card={card} />

        {card.description ? (
          <p className="mt-3 text-sm leading-relaxed text-brand-gray-300">
            {card.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {card.websiteUrl ? (
            <a
              href={card.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black transition hover:bg-brand-orange/90"
            >
              Visit website
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <ClaimState card={card} />
        </div>
      </div>
    </article>
  );
}

function GridCard({ card }: { card: DirectoryCard }) {
  const featured = card.tier === "featured";

  // The grid column span lives on the wrapper in DirectoryListing, since that
  // wrapper — not this article — is the grid child.
  return (
    <article
      data-business-card={card.id}
      data-tier={card.tier}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-brand-gray-900 to-black transition-all duration-200 hover:-translate-y-1 hover:border-brand-orange/40 ${
        featured
          ? "border-brand-orange/30 ring-1 ring-brand-orange/30"
          : "border-white/10"
      }`}
    >
      <div className="h-1 w-full bg-gradient-to-r from-brand-orange via-brand-orange/60 to-transparent" />

      <div className="flex flex-1 flex-col p-5">
        {featured ? (
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Featured
          </div>
        ) : null}

        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-lg font-bold text-brand-orange ring-1 ring-white/10">
            {card.businessName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-white">
              {card.businessName}
            </h3>
            <MetaRow card={card} />
          </div>
        </div>

        {card.description ? (
          <p
            className={`mt-3 text-sm leading-relaxed text-brand-gray-300 ${
              featured ? "line-clamp-3" : "line-clamp-2"
            }`}
          >
            {card.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
          {card.websiteUrl ? (
            <a
              href={card.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-gray-400 transition hover:text-brand-orange"
            >
              {displayHost(card.websiteUrl)}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <ClaimState card={card} />
        </div>
      </div>
    </article>
  );
}

function MetaRow({ card }: { card: DirectoryCard }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-brand-gray-400">
      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-brand-orange">
        <DirectoryCategoryIcon
          category={card.category}
          className="h-3 w-3"
          strokeWidth={2.5}
        />
        {card.subcategory ?? CATEGORY_META[card.category].label}
      </span>
      {card.phone ? (
        <a
          href={`tel:${card.phone.replace(/\D/g, "")}`}
          className="inline-flex items-center gap-1 hover:text-white"
        >
          <Phone className="h-3 w-3" aria-hidden="true" />
          {card.phone}
        </a>
      ) : null}
    </div>
  );
}

/**
 * The conversion mechanism: a claimed listing links to the real profile, an
 * unclaimed one invites the owner to sign up. Kept quiet, not error-styled —
 * most listings will be unclaimed for a long time.
 */
function ClaimState({ card }: { card: DirectoryCard }) {
  if (card.claimedProfileId) {
    return (
      <Link
        href={`/profile/${card.claimedProfileId}`}
        className="inline-flex items-center gap-1 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-2.5 py-1 text-xs font-bold text-brand-orange transition hover:bg-brand-orange/20"
      >
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        On SplitMic
      </Link>
    );
  }

  return (
    <Link
      href="/signup"
      className="text-xs text-brand-gray-500 transition hover:text-brand-gray-300 hover:underline"
    >
      Is this your business?
    </Link>
  );
}

function displayHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
