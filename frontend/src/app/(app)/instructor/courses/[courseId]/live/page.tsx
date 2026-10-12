import { TabRedirect } from "@/components/instructor/tab-redirect";

/** /instructor/courses/[courseId]/live → Live tab of the course builder. */
export default function LiveRedirectPage() {
  return <TabRedirect tab="live" />;
}
