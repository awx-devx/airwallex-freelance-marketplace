import { Suspense } from "react";
import { PayScreen } from "@/components/screens/pay-screen";
import { Skeleton } from "@/components/ui/skeleton";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3" aria-label="Loading payment">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PayScreen id={id} />
    </Suspense>
  );
}
