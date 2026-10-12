import { CalendarClock, CircleCheck, GripVertical, Headphones, Play, Sparkles } from "lucide-react";
import type { ItemType, Visibility } from "@/lib/api/types";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { LevelBadge } from "@/components/course/badges";
import { useTranslations } from "next-intl";
import { VISIBILITY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";


function MiniVisibility({ visibility, when }: { visibility: Visibility; when?: string }) {
  const t = useTranslations("visibility");
  const meta = VISIBILITY_META[visibility];
  return (
    <Badge variant="plain" className={cn("text-[11px]", meta.className)}>
      {visibility === "SCHEDULED" ? <CalendarClock /> : <span className={cn("size-1.5 rounded-full", meta.dot)} />}
      {t(`${visibility}.label`)}
      {when && <span className="hidden opacity-80 sm:inline">· {when}</span>}
    </Badge>
  );
}

/** Static product preview composed from the real UI building blocks. */
export function ProductMock() {
  const t = useTranslations("marketing.mock");
  const tc = useTranslations("common");
  const rows: { type: ItemType; title: string; meta: string; visibility: Visibility; when?: string }[] = [
    { type: "TEXT", title: "Begrüßungen und Vorstellungen", meta: tc("minutesShort", { count: 12 }), visibility: "LIVE" },
    { type: "AUDIO", title: "Hörverstehen: Im Café", meta: t("files"), visibility: "LIVE" },
    { type: "DOCUMENT", title: "Arbeitsblatt: Verben im Präsens", meta: "PDF · DOCX", visibility: "LIVE" },
    { type: "VIDEO", title: "Video: Unterwegs in Berlin", meta: tc("minutesShort", { count: 14 }), visibility: "SCHEDULED", when: t("monday") },
    { type: "QUIZ", title: "Quiz: Lektion 1", meta: t("questions"), visibility: "DRAFT" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[640px]" aria-hidden>
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-brand/25 via-transparent to-info/20 blur-3xl" />

      {/* Builder window */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-black/5">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 truncate text-xs text-muted-foreground">{t("window")}</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LevelBadge level="A1" />
              <span className="text-sm font-semibold">Modul 1 · Erste Schritte</span>
            </div>
            <MiniVisibility visibility="LIVE" />
          </div>
          <ul className="mt-4 grid gap-1.5">
            {rows.map((r) => (
              <li key={r.title} className="flex items-center gap-2.5 rounded-lg border bg-background/60 px-2 py-2">
                <GripVertical className="size-3.5 shrink-0 text-muted-foreground/60" />
                <ItemTypeIcon type={r.type} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">{r.meta}</p>
                </div>
                <MiniVisibility visibility={r.visibility} when={r.when} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Floating learner card */}
      <div className="absolute -bottom-10 -left-4 hidden w-60 rounded-xl border bg-card p-4 shadow-lg sm:block lg:-left-12">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
            <Headphones className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Hörverstehen: Im Café</p>
            <p className="text-[11px] text-muted-foreground">{t("playback")}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
            <Play className="size-3" />
          </span>
          <div className="h-1 flex-1 rounded-full bg-muted">
            <div className="h-full w-2/5 rounded-full bg-brand" />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">1:12</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t("progress")}</span>
          <span className="font-medium text-foreground">64%</span>
        </div>
        <Progress value={64} className="mt-1.5 h-1.5" />
      </div>

      {/* Floating approval toast */}
      <div className="absolute -top-6 -right-3 hidden items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 shadow-lg sm:flex lg:-right-10">
        <CircleCheck className="size-4 text-success" />
        <div>
          <p className="text-xs font-medium">{t("approved")}</p>
          <p className="text-[11px] text-muted-foreground">{t("waitlist")}</p>
        </div>
        <Sparkles className="size-3.5 text-brand" />
      </div>
    </div>
  );
}
