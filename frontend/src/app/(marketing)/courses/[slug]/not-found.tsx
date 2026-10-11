import Link from "next/link";
import { BookX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function CourseNotFound() {
  const t = useTranslations("course");
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <EmptyState
        icon={BookX}
        title={t("notFoundTitle")}
        description={t("notFoundText")}
        action={
          <Button asChild>
            <Link href="/courses">{t("browseAll")}</Link>
          </Button>
        }
      />
    </div>
  );
}
