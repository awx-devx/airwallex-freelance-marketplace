import { Suspense } from "react";
import { HomeScreen } from "@/components/screens/home-screen";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3" aria-label="Loading">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-28 w-full" />
        </div>
      }
    >
      <HomeScreen />
    </Suspense>
  );
}
