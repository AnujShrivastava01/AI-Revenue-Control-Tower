import { Skeleton } from "@/components/ui/primitives";

export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mt-2.5 h-3 w-96" />

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[236px] w-full" />
        ))}
      </div>

      <Skeleton className="mt-8 h-[124px] w-full" />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    </div>
  );
}
