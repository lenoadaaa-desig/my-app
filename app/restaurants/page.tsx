"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RestaurantCard, type RestaurantCardData } from "@/components/restaurant-card";
import { MESSAGES, ERROR_MESSAGES_TH } from "@/constants/messages";

type ApiError = { code: string; message: string };
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

type ListResult = {
  items: RestaurantCardData[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};

const ALL_CATEGORIES = "__all__";
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;

function errorText(err: ApiError): string {
  return ERROR_MESSAGES_TH[err.code as keyof typeof ERROR_MESSAGES_TH] ?? MESSAGES.common.errorGeneric;
}

export default function RestaurantsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (category !== ALL_CATEGORIES) params.set("category", category);

    let cancelled = false;
    // Same "start of an async operation" idiom as booking-box.tsx's
    // fetchSlots — see its comment for why the newer set-state-in-effect
    // compiler rule gets a targeted disable here instead of a restructure.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch(`/api/restaurants?${params.toString()}`)
      .then((res) => res.json() as Promise<ApiResult<ListResult>>)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error);
          return;
        }
        setResult(res.data);
      })
      .catch(() => {
        if (!cancelled) setError({ code: "", message: MESSAGES.common.errorGeneric });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, category, page, retryTick]);

  const totalPages = useMemo(
    () => (result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1),
    [result]
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{MESSAGES.nav.searchRestaurants}</h1>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-mute" />
          <Input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder={MESSAGES.restaurant.searchPlaceholder}
            className="pl-8"
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value ?? ALL_CATEGORIES);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48">
            {/* Base UI's Select.Value renders the raw `value` by default
                (unlike Radix, it does NOT auto-derive the matched Item's
                label) — without this children-function, picking "ทุกหมวด"
                would show the literal sentinel string "__all__" in the UI.
                Real categories don't need a lookup since the category's own
                name already is its display label. */}
            <SelectValue placeholder={MESSAGES.restaurant.categoryFilterLabel}>
              {(value: string) => (value === ALL_CATEGORIES ? MESSAGES.restaurant.categoryAllLabel : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>{MESSAGES.restaurant.categoryAllLabel}</SelectItem>
            {(result?.categories ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-surface px-4 py-10 text-center">
          <p className="text-sm text-bad">{errorText(error)}</p>
          <Button variant="outline" size="sm" onClick={() => setRetryTick((t) => t + 1)}>
            {MESSAGES.common.retry}
          </Button>
        </div>
      ) : !result || result.items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg bg-surface px-4 py-16 text-center">
          <p className="font-medium text-ink">{MESSAGES.restaurant.listEmptyTitle}</p>
          <p className="text-sm text-ink-soft">{MESSAGES.restaurant.listEmptyHint}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {MESSAGES.restaurant.prevPage}
              </Button>
              <p className="text-sm text-ink-soft">{MESSAGES.restaurant.pageOf(page, totalPages)}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {MESSAGES.restaurant.nextPage}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
