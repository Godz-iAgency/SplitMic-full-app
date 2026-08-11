import Link from "next/link";
import {
  ExternalLink,
  Phone,
  Star,
  Sparkles,
  BadgeCheck,
  Navigation,
  MessageSquare,
} from "lucide-react";
import type { DirectoryCard } from "@/lib/directory/queries";
import { CATEGORY_META } from "@/lib/directory/categories";
import {
  faviconUrl,
  displayHost,
  directionsUrl,
  reviewsUrl,
} from "@/lib/directory/media";
import { DirectoryCategoryIcon } from "./DirectoryCategoryIcon";
import { ShareButton } from "./ShareButton";

/**
 * Three visually distinct treatments by tier. This is what makes the page read
 * as a curated guide rather than a dumped list — a spotlight listing should be
 * unmistakable at a glance, not just first in the sort order.
 *
 * Every card carries the same anatomy: an image band (website screenshot, or a
 * brand gradient until one is captured), the business's logo, and a row of
 * things a visitor can actually do — visit, get directions, read reviews, share.
 */
export function BusinessCard({ card }: { card: DirectoryCard }) {
  if (card.tier === "spotlight") return <SpotlightCard card={card} />;
  return <GridCard card={card} />;
}

/** Deep link back to this specific listing, used by Share. */
function cardPath(card: DirectoryCard): string {
  return `/directory/${CATEGORY_META[card.category].slug}#b-${card.id}`;
}

function SpotlightCard({ card }: { card: DirectoryCard }) {
  return (
    <article
      id={`b-${card.id}`}
      data-business-card={card.id}
      data-tier="spotlight"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-orange/30 via-brand-orange/10 to-transparent p-[1.5px]"
    >
      <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-gradient-to-br from-brand-gray-900 to-black">
        <ImageBand card={card} height="h-40 sm:h-48" />

        {/* pt clears the logo overhanging the image band's lower edge. */}
        <div className="p-5 pt-8 sm:p-6 sm:pt-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange">
                <Star className="h-3.5 w-3.5 fill-brand-orange" aria-hidden="true" />
                Spotlight
              </div>
              <h3 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
                {card.businessName}
              </h3>
              <MetaRow card={card} />
            </div>
          </div>

          {card.description ? (
            <p className="mt-3 text-sm leading-relaxed text-brand-gray-300">
              {card.description}
            </p>
          ) : null}

          <ActionRow card={card} primary />
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
      id={`b-${card.id}`}
      data-business-card={card.id}
      data-tier={card.tier}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-brand-gray-900 to-black transition-all duration-200 hover:-translate-y-1 hover:border-brand-orange/40 ${
        featured
          ? "border-brand-orange/30 ring-1 ring-brand-orange/30"
          : "border-white/10"
      }`}
    >
      <ImageBand card={card} height="h-28" badge={featured ? "featured" : null} />

      {/* pt-7 clears the logo, which hangs 20px below the image band. */}
      <div className="flex flex-1 flex-col p-4 pt-7">
        <h3 className="text-base font-bold leading-snug text-white">
          {card.businessName}
        </h3>
        <MetaRow card={card} />

        {card.description ? (
          <p
            className={`mt-2 text-sm leading-relaxed text-brand-gray-300 ${
              featured ? "line-clamp-3" : "line-clamp-2"
            }`}
          >
            {card.description}
          </p>
        ) : null}

        <ActionRow card={card} />
      </div>
    </article>
  );
}

/**
 * The card's photo, in order of how much it actually tells a visitor:
 *
 *   1. The Google Places photo — a real shot of the venue or shopfront.
 *   2. A screenshot of the business's website.
 *   3. A brand gradient.
 *
 * Both photo sources are backfilled in batches, so plenty of cards sit on the
 * gradient at any given time — it has to look deliberate on its own, not like
 * a broken image.
 */
function ImageBand({
  card,
  height,
  badge,
}: {
  card: DirectoryCard;
  height: string;
  badge?: "featured" | null;
}) {
  const logo = faviconUrl(card.websiteUrl);
  const photo = card.placePhotoUrl ?? card.screenshotUrl;
  // A venue photo is framed to be looked at; a website screenshot is a page,
  // so anchor it to the top where the header and hero live.
  const objectPosition = card.placePhotoUrl ? "object-center" : "object-top";

  return (
    <div className={`relative w-full ${height} shrink-0 overflow-hidden`}>
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            className={`h-full w-full object-cover ${objectPosition}`}
            loading="lazy"
          />
          {/* Keeps a bright photo from fighting the dark card body. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
        </>
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-brand-orange/25 via-brand-gray-900 to-black">
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] [background-size:16px_16px]" />
        </div>
      )}

      {badge === "featured" ? (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-orange px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-black">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Featured
        </span>
      ) : null}

      <div className="absolute right-3 top-3">
        <ShareButton businessName={card.businessName} path={cardPath(card)} />
      </div>

      {/* Logo, straddling the band's lower edge like a profile avatar. */}
      <div className="absolute -bottom-5 left-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-brand-gray-900 ring-1 ring-white/15">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-lg font-bold text-brand-orange">
            {card.businessName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

function MetaRow({ card }: { card: DirectoryCard }) {
  const meta = CATEGORY_META[card.category];

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-gray-400">
      {/* Subcategory is a filter link, not just a label — the fastest way to
          go from "this one looks right" to "show me more like it". */}
      {card.subcategory ? (
        <Link
          href={`/directory/${meta.slug}?sub=${encodeURIComponent(card.subcategory)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-2 py-0.5 font-semibold text-brand-orange transition hover:bg-brand-orange/20"
        >
          <DirectoryCategoryIcon
            category={card.category}
            className="h-3 w-3"
            strokeWidth={2.5}
          />
          {card.subcategory}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-brand-orange">
          <DirectoryCategoryIcon
            category={card.category}
            className="h-3 w-3"
            strokeWidth={2.5}
          />
          {meta.label}
        </span>
      )}

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
 * Website / Directions / Reviews — the three things a visitor actually wants.
 * Directions and Reviews are Google Maps searches by business name, which
 * resolves reliably for a named Austin business and needs no stored address.
 */
function ActionRow({ card, primary }: { card: DirectoryCard; primary?: boolean }) {
  // Taller on mobile (py-2.5 ≈ 42px) so it clears a comfortable tap target on
  // a phone, tightening at sm: where a cursor makes the height unnecessary.
  const pill =
    "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white transition hover:border-brand-orange/50 hover:text-brand-orange sm:py-1.5";

  return (
    <div className="mt-auto space-y-2 pt-4">
      <div className="flex flex-wrap gap-2">
        {card.websiteUrl ? (
          <a
            href={card.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={
              primary
                ? "inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black transition hover:bg-brand-orange/90"
                : pill
            }
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {primary ? "Visit website" : "Website"}
          </a>
        ) : null}

        <a
          href={directionsUrl(card.businessName)}
          target="_blank"
          rel="noopener noreferrer"
          className={pill}
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          Directions
        </a>

        <a
          href={reviewsUrl(card.businessName)}
          target="_blank"
          rel="noopener noreferrer"
          className={pill}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Reviews
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {card.websiteUrl ? (
          <span className="truncate text-xs text-brand-gray-400">
            {displayHost(card.websiteUrl)}
          </span>
        ) : null}
        <ClaimState card={card} />
      </div>
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
      className="text-xs text-brand-gray-400 transition hover:text-white hover:underline"
    >
      Is this your business?
    </Link>
  );
}
