import type { FlashcardArticle } from "@/lib/api/types";
import { ARTICLE_META } from "@/lib/flashcards";
import { cn } from "@/lib/utils";

/**
 * der = blue, die = red, das = green. The article itself is always written out and the outline differs
 * (solid, dashed, dotted), so the gender never depends on colour alone.
 */
export function ArticleBadge({ article, className }: { article: FlashcardArticle; className?: string }) {
  const meta = ARTICLE_META[article];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold",
        meta.className,
        meta.border === "solid" && "ring-2 ring-inset",
        meta.border === "dashed" && "border-2 border-dashed border-current/70",
        meta.border === "dotted" && "border-2 border-dotted border-current/70",
        className,
      )}
      data-article={article}
    >
      {article}
    </span>
  );
}
