"use client";

import Link from "next/link";
import { isPlayerType, writePendingType } from "@/lib/pendingProfile";
import type { DirectoryCategory } from "@/lib/directory/categories";

/**
 * "Is this your business?" → signup, with the listing's category already
 * picked as the player type in onboarding. Every directory category maps 1:1
 * onto a player type (lib/directory/categories.ts), so a backline listing's
 * owner lands on "Backline Company" instead of hunting for it.
 *
 * The type is stored on click, not read from the URL: the signup page ignores
 * ?type=, and only localStorage survives the email-confirmation round trip.
 * This links to signup only. It never connects the new account to the listing;
 * that stays a manual admin step (PROGRESS.md §2 #27).
 */
export function ClaimListingLink({
  category,
  className,
  children,
}: {
  category?: DirectoryCategory | null;
  className?: string;
  children: React.ReactNode;
}) {
  const type = isPlayerType(category) ? category : null;

  return (
    <Link
      href={type ? `/signup?type=${type}` : "/signup"}
      onClick={() => {
        if (type) writePendingType(type);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
