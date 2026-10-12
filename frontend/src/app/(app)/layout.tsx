import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { PageSkeleton, RequireAuth } from "@/components/layout/require-auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <AppHeader />
      <main id="main" className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <RequireAuth>{children}</RequireAuth>
        </Suspense>
      </main>
    </div>
  );
}
