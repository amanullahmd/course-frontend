import { LearnShell } from "@/components/learn/learn-shell";

export default function LearnLayout({ children }: LayoutProps<"/learn/[courseId]">) {
  return <LearnShell>{children}</LearnShell>;
}
