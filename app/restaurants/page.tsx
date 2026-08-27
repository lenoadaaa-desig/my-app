import type { Metadata } from "next";
import { MESSAGES } from "@/constants/messages";
import { RestaurantsView } from "./restaurants-view";

// Server Component wrapper only so this page can export metadata —
// generateMetadata/metadata are Server-Component-only, and the actual page
// (search input, category filter, client-side fetch) needs "use client".
// Scoped to this page.tsx only (not a layout.tsx), so it has no effect on
// /restaurants/[id]'s own generateMetadata below it.
export const metadata: Metadata = {
  title: MESSAGES.nav.searchRestaurants,
  description: MESSAGES.metadata.restaurantsListDescription,
};

export default function RestaurantsPage() {
  return <RestaurantsView />;
}
