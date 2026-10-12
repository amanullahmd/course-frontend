import { TabRedirect } from "@/components/instructor/tab-redirect";

/** Target of the "new submission" notification: Submissions tab of the course builder (opens `?submission=<id>`). */
export default function SubmissionsRedirectPage() {
  return <TabRedirect tab="submissions" />;
}
