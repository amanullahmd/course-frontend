import Link from "next/link";
import { BookX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function CourseNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <EmptyState
        icon={BookX}
        title="Course not found"
        description="This course doesn't exist or isn't published right now."
        action={
          <Button asChild>
            <Link href="/courses">Browse all courses</Link>
          </Button>
        }
      />
    </div>
  );
}
