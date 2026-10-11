import { InstructorSidebar } from "@/components/layout/instructor-sidebar";
import { RequireAuth } from "@/components/layout/require-auth";

export default function InstructorLayout({ children }: LayoutProps<"/instructor">) {
  return (
    <RequireAuth roles={["INSTRUCTOR", "ADMIN"]}>
      <div className="flex flex-1">
        <InstructorSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RequireAuth>
  );
}
