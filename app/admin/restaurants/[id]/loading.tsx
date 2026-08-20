import { Skeleton } from "@/components/ui/skeleton";

export default function AdminRestaurantDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
