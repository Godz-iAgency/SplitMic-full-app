import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";
import { isAdminEmail } from "@/lib/supabase/admin";

const TABLE_BY_TYPE: Record<PlayerType, string> = {
  band: "band_details",
  venue: "venue_details",
  talent_buyer: "talent_buyer_details",
  record_label: "record_label_details",
  festival: "festival_details",
};

export type UserProfile = {
  // From users table
  id: string;
  email: string | null;
  full_name: string | null;
  // From profiles table
  profile_id: string | null;
  player_type: PlayerType | null;
  street_address: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  bio: string | null;
  phone_number: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
};

export async function getOnboardingStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: UserProfile | null; isComplete: boolean }> {
  // Step 1: get the user row
  const { data: user } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (!user) return { profile: null, isComplete: false };

  // Admin accounts skip onboarding entirely — they have no player profile.
  // Returning isComplete: true prevents every authenticated page from bouncing
  // the admin to /onboarding.
  if (isAdminEmail(user.email)) {
    return {
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        profile_id: null,
        player_type: null,
        street_address: null,
        address_line_2: null,
        city: null,
        state: null,
        zip_code: null,
        bio: null,
        phone_number: null,
        website_url: null,
        instagram_handle: null,
        instagram_followers: null,
      },
      isComplete: true,
    };
  }

  // Step 2: get the profiles row (one per user for Phase 1)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select(
      "id, player_type, street_address, address_line_2, city, state, zip_code, bio, phone_number, website_url, instagram_handle, instagram_followers",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const profile: UserProfile = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    profile_id: profileRow?.id ?? null,
    player_type: (profileRow?.player_type as PlayerType) ?? null,
    street_address: profileRow?.street_address ?? null,
    address_line_2: profileRow?.address_line_2 ?? null,
    city: profileRow?.city ?? null,
    state: profileRow?.state ?? null,
    zip_code: profileRow?.zip_code ?? null,
    bio: profileRow?.bio ?? null,
    phone_number: profileRow?.phone_number ?? null,
    website_url: profileRow?.website_url ?? null,
    instagram_handle: profileRow?.instagram_handle ?? null,
    instagram_followers: profileRow?.instagram_followers ?? null,
  };

  // Not complete if no profile row, or missing player_type / address
  if (
    !profileRow ||
    !profileRow.player_type ||
    !profileRow.street_address ||
    !profileRow.zip_code
  ) {
    return { profile, isComplete: false };
  }

  // Step 3: check that the detail table row exists
  const table = TABLE_BY_TYPE[profileRow.player_type as PlayerType];
  const { data: detailRow } = await supabase
    .from(table)
    .select("id")
    .eq("profile_id", profileRow.id)
    .maybeSingle();

  return { profile, isComplete: !!detailRow };
}

export function tableForPlayerType(playerType: PlayerType): string {
  return TABLE_BY_TYPE[playerType];
}
