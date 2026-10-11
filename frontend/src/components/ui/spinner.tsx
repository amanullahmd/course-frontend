import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  const t = useTranslations("common");
  return (
    <span role="status" className="inline-flex">
      <LoaderCircle className={cn("size-4 animate-spin text-muted-foreground", className)} aria-hidden />
      <span className="sr-only">{label ?? t("loading")}</span>
    </span>
  );
}
