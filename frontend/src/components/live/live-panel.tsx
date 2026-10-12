"use client";

import * as React from "react";
import { CalendarClock, CalendarPlus, ClipboardCheck, Pencil, Repeat, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { LiveSessionDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useNow } from "@/hooks/use-now";
import { useDeleteSession, useLiveSessions } from "@/hooks/queries/practice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceSheet } from "./attendance-sheet";
import { SeriesDialog, SessionDialog } from "./session-dialogs";

function SessionRow({
  session,
  past,
  onEdit,
  onAttendance,
  onDelete,
}: {
  session: LiveSessionDto;
  past: boolean;
  onEdit: () => void;
  onAttendance: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("live");
  const fmt = useFormat();
  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center", (past || session.cancelled) && "bg-muted/30")}>
      <div className="flex w-full items-center gap-3 sm:w-40 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5">
        <p className="text-sm font-semibold">{fmt.date(session.startsAt, "EEE d MMM yyyy")}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {fmt.date(session.startsAt, "HH:mm")}–{fmt.date(session.endsAt, "HH:mm")} · {t("minutes", { count: session.durationMinutes })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("font-medium break-words", session.cancelled && "line-through decoration-muted-foreground/60")}>{session.title}</span>
          {session.cancelled && <Badge variant="destructive">{t("state.cancelled")}</Badge>}
          {session.seriesId && (
            <Badge variant="outline">
              <Repeat /> {t("seriesBadge")}
            </Badge>
          )}
          {session.recordingUrl && <Badge variant="info">{t("recordingBadge")}</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {session.attendanceRecorded > 0 ? t("attendanceSummary", { present: session.presentCount, recorded: session.attendanceRecorded }) : t("noAttendanceYet")}
          {session.joinUrl ? "" : ` · ${t("noJoinUrl")}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {!session.cancelled && (
          <Button variant="outline" size="sm" onClick={onAttendance}>
            <ClipboardCheck /> {t("attendance.title")}
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("editSessionAria", { title: session.title })}>
          <Pencil />
        </Button>
        <Button variant="destructive-ghost" size="icon-sm" onClick={onDelete} aria-label={t("deleteSessionAria", { title: session.title })}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

/** "Live" tab of the course builder: sessions and weekly series, attendance sheets. */
export function LivePanel({ courseId }: { courseId: string }) {
  const t = useTranslations("live");
  const errorMessage = useErrorMessage();
  const now = useNow();
  const sessions = useLiveSessions(courseId);
  const del = useDeleteSession(courseId);
  const [editing, setEditing] = React.useState<LiveSessionDto | null | "new">(null);
  const [series, setSeries] = React.useState(false);
  const [attendance, setAttendance] = React.useState<LiveSessionDto | null>(null);
  const [toDelete, setToDelete] = React.useState<LiveSessionDto | null>(null);

  const list = sessions.data ?? [];
  const upcoming = list.filter((s) => Date.parse(s.endsAt) > now);
  const past = list.filter((s) => Date.parse(s.endsAt) <= now).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

  const renderList = (items: LiveSessionDto[], isPast: boolean) => (
    <ul className="grid gap-3">
      {items.map((s) => (
        <SessionRow key={s.id} session={s} past={isPast} onEdit={() => setEditing(s)} onAttendance={() => setAttendance(s)} onDelete={() => setToDelete(s)} />
      ))}
    </ul>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold tracking-tight">{t("panelTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("panelText")}</p>
        </div>
        <Button variant="outline" onClick={() => setSeries(true)}>
          <Repeat /> {t("newSeries")}
        </Button>
        <Button onClick={() => setEditing("new")}>
          <CalendarPlus /> {t("newSession")}
        </Button>
      </div>

      {sessions.isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Video}
          title={t("panelEmptyTitle")}
          description={t("panelEmptyText")}
          action={
            <Button onClick={() => setEditing("new")}>
              <CalendarClock /> {t("newSession")}
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="live-up" className="grid gap-3">
            <h3 id="live-up" className="text-sm font-semibold">
              {t("upcoming")} <span className="font-normal text-muted-foreground">({upcoming.length})</span>
            </h3>
            {upcoming.length ? renderList(upcoming, false) : <p className="text-sm text-muted-foreground">{t("noUpcomingText")}</p>}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="live-past" className="grid gap-3">
              <h3 id="live-past" className="text-sm font-semibold">
                {t("past")} <span className="font-normal text-muted-foreground">({past.length})</span>
              </h3>
              {renderList(past, true)}
            </section>
          )}
        </>
      )}

      <SessionDialog courseId={courseId} open={editing !== null} session={editing === "new" ? null : editing} onOpenChange={(o) => !o && setEditing(null)} />
      <SeriesDialog courseId={courseId} open={series} onOpenChange={setSeries} />
      <AttendanceSheet courseId={courseId} session={attendance} onClose={() => setAttendance(null)} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("deleteTitle", { title: toDelete?.title ?? "" })}
        description={t("deleteText")}
        confirmLabel={t("delete")}
        destructive
        loading={del.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setToDelete(null);
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      />
    </div>
  );
}
