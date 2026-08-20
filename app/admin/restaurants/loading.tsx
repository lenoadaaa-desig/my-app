import { Skeleton } from "@/components/ui/skeleton";

export default function AdminRestaurantsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
