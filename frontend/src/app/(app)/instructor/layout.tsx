import { InstructorSidebar } from "@/components/layout/instructor-sidebar";
import { RequireAuth } from "@/components/layout/require-auth";
import { InstructorReviewGate } from "@/components/instructor/review-gate";

export default function InstructorLayout({ children }: LayoutProps<"/instructor">) {
  return (
    <RequireAuth roles={["INSTRUCTOR", "ADMIN"]}>
      <InstructorReviewGate>
        <div className="flex flex-1">
          <InstructorSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </InstructorReviewGate>
    </RequireAuth>
  );
}
