import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 bg-canvas px-4 py-6 sm:px-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-full rounded-lg" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
