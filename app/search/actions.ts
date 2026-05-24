"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  searchProfiles,
  type SearchResult,
  type SortOption,
} from "@/lib/supabase/search";
import type { PlayerType } from "@/lib/types";

export type LoadMoreFilters = {
  playerType: PlayerType | "all";
  query?: string;
  genre?: string;
  sort?: SortOption;
};

/**
 * Server action invoked by the "Load more" button in <SearchResults />.
 * Fetches the next page of results starting at the given offset, with the
 * exact same filter state the user has on screen.
 */
export async function loadMoreSearchResults(
  filters: LoadMoreFilters,
  offset: number,
): Promise<SearchResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { cards: [], hasMore: false };

  return searchProfiles(supabase, {
    playerType: filters.playerType,
    offset,
    query: filters.query,
    genre: filters.genre,
    sort: filters.sort,
  });
}
