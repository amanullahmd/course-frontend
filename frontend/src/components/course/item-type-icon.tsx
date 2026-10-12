import { useTranslations } from "next-intl";
import type { ItemType } from "@/lib/api/types";
import { ITEM_TYPE_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ItemTypeIcon({ type, className, boxed = true }: { type: ItemType; className?: string; boxed?: boolean }) {
  const t = useTranslations("itemTypes");
  const meta = ITEM_TYPE_META[type];
  const Icon = meta.icon;
  const label = t(`${type}.label`);
  if (!boxed) return <Icon className={cn("size-4 shrink-0", className)} aria-label={label} />;
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.className, className)} title={label}>
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
