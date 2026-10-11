"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { CefrLevel } from "@/lib/api/types";
import { CEFR_LEVELS, CEFR_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { SearchInput } from "@/components/ui/search-input";

export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentQ = params.get("q") ?? "";
  const currentLevel = (params.get("level") as CefrLevel | null) ?? null;
  const [q, setQ] = React.useState(currentQ);
  const debounced = useDebouncedValue(q, 350);
  const [pending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (next: { q?: string; level?: CefrLevel | null }) => {
      const sp = new URLSearchParams(params.toString());
      if (next.q !== undefined) {
        if (next.q) sp.set("q", next.q);
        else sp.delete("q");
      }
      if (next.level !== undefined) {
        if (next.level) sp.set("level", next.level);
        else sp.delete("level");
      }
      sp.delete("page");
      const qs = sp.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    if (debounced.trim() !== currentQ) navigate({ q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced input
  }, [debounced]);

  return (
    <div className="grid gap-4">
      <div className="relative max-w-xl">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search courses, topics or tags… e.g. Grammatik, Beruf, Prüfung"
          aria-label="Search courses"
          className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:text-[15px]"
        />
        {pending && (
          <LoaderCircle className="absolute top-1/2 -right-7 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading results" />
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by level">
        <button
          type="button"
          aria-pressed={!currentLevel}
          onClick={() => navigate({ level: null })}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
            !currentLevel && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          All levels
        </button>
        {CEFR_LEVELS.map((level) => {
          const active = currentLevel === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              onClick={() => navigate({ level: active ? null : level })}
              title={CEFR_META[level].name}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                active && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <span className={cn("size-2 rounded-full", CEFR_META[level].dot)} aria-hidden />
              {level}
              <span className={cn("hidden text-xs font-normal sm:inline", active ? "opacity-80" : "text-muted-foreground")}>
                {CEFR_META[level].name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
