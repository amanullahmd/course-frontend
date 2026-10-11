import { ChevronDown, Clock } from "lucide-react";
import type { OutlineModule } from "@/lib/api/types";
import { ITEM_TYPE_META } from "@/lib/constants";
import { formatMinutes, pluralize } from "@/lib/utils";
import { ItemTypeIcon } from "./item-type-icon";

export function CourseOutline({ modules }: { modules: OutlineModule[] }) {
  if (modules.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">The outline will appear here once the first module is published.</p>;
  }
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {modules.map((m, index) => {
        const minutes = m.items.reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0);
        return (
          <details key={m.id} className="group" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{m.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {pluralize(m.items.length, "lesson")}
                  {minutes > 0 && ` · ${formatMinutes(minutes)}`}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-4">
              {m.description && <p className="mb-3 pl-12 text-sm text-muted-foreground">{m.description}</p>}
              <ul className="grid gap-1 sm:pl-12">
                {m.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
                    <ItemTypeIcon type={item.type} className="size-7" />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{ITEM_TYPE_META[item.type].label}</span>
                    {item.durationMinutes ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Clock className="size-3" /> {formatMinutes(item.durationMinutes)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        );
      })}
    </div>
  );
}
