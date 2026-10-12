"use client";

import * as React from "react";
import { CalendarClock, Copy, Ellipsis, Mail, Megaphone, PencilLine, Pin, Plus, Send, Trash, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AnnouncementDto, AnnouncementStatus } from "@/lib/api/announcements";
import { stripHtml, cn } from "@/lib/utils";
import { useAnnouncementMutations, useCourseAnnouncements } from "@/hooks/queries/announcements";
import { useCourseEnrollments } from "@/hooks/queries/instructor";
import { useFormat } from "@/hooks/use-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { AnnouncementComposer, type ComposerState } from "./announcement-composer";

const STATUS_VARIANT: Record<AnnouncementStatus, "secondary" | "info" | "success"> = {
  DRAFT: "secondary",
  SCHEDULED: "info",
  SENT: "success",
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  const t = useTranslations("announcements.status");
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

function AnnouncementRow({
  a,
  onEdit,
  onDuplicate,
  onSend,
  onDelete,
}: {
  a: AnnouncementDto;
  onEdit: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("announcements");
  const fmt = useFormat();
  const sent = a.status === "SENT";
  const preview = stripHtml(a.body);
  return (
    <li className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {a.pinned && (
            <Tooltip content={t("pinned")}>
              <Pin className="size-3.5 shrink-0 fill-current text-brand-strong" aria-label={t("pinned")} />
            </Tooltip>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="min-w-0 truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {a.title}
          </button>
          <AnnouncementStatusBadge status={a.status} />
          {a.sendEmail && (
            <Tooltip content={t("emailed")}>
              <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("emailed")} />
            </Tooltip>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {a.status === "SENT" && <span>{t("sentOn", { date: fmt.dateTime(a.sentAt) })}</span>}
          {a.status === "SCHEDULED" && (
            <span className="flex items-center gap-1 font-medium text-info">
              <CalendarClock className="size-3.5" /> {t("scheduledFor", { date: fmt.dateTime(a.scheduledAt) })}
            </span>
          )}
          {a.status === "DRAFT" && <span>{t("editedOn", { when: fmt.relative(a.updatedAt) })}</span>}
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {a.audience === "ALL_APPROVED" ? t("audienceAll") : t("audienceSelected")} ·{" "}
            {sent ? t("recipients", { count: a.recipientCount }) : t("wouldReach", { count: a.recipientCount })}
          </span>
        </p>
        {preview && <p className="mt-1.5 line-clamp-1 text-[13px] text-muted-foreground">{preview}</p>}
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        {sent ? (
          <div className="grid w-full gap-1.5 sm:w-36" title={t("readOf", { read: a.readCount, total: a.recipientCount })}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("readOf", { read: a.readCount, total: a.recipientCount })}</span>
              <span className="font-medium tabular-nums">{a.readPercent}%</span>
            </div>
            <Progress value={a.readPercent} className="h-1.5" indicatorClassName={a.readPercent >= 100 ? "bg-success" : undefined} />
          </div>
        ) : (
          <Button size="xs" variant="outline" onClick={onSend} className="sm:opacity-90">
            <Send /> {t("sendNow")}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="ml-auto shrink-0" aria-label={t("actions", { title: a.title })}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilLine /> {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy /> {t("duplicate")}
            </DropdownMenuItem>
            {!sent && (
              <DropdownMenuItem onSelect={onSend}>
                <Send /> {t("sendNow")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash /> {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/** Instructor "Announcements" tab of the course builder. */
export function AnnouncementsPanel({ courseId }: { courseId: string }) {
  const t = useTranslations("announcements");
  const tc = useTranslations("announcements.composer");
  const list = useCourseAnnouncements(courseId);
  const approved = useCourseEnrollments(courseId, "APPROVED");
  const { send, remove } = useAnnouncementMutations(courseId);
  const [composer, setComposer] = React.useState<ComposerState | null>(null);
  const [toSend, setToSend] = React.useState<AnnouncementDto | null>(null);
  const [toDelete, setToDelete] = React.useState<AnnouncementDto | null>(null);
  const items = list.data ?? [];

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setComposer({})} className="shrink-0">
          <Plus /> {t("new")}
        </Button>
      </div>

      {list.isPending ? (
        <div className="divide-y rounded-xl border bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid gap-2 p-5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={
            <Button onClick={() => setComposer({})}>
              <Plus /> {t("new")}
            </Button>
          }
        />
      ) : (
        <ul className={cn("divide-y rounded-xl border bg-card shadow-xs")}>
          {items.map((a) => (
            <AnnouncementRow
              key={a.id}
              a={a}
              onEdit={() => setComposer({ announcement: a })}
              onDuplicate={() => setComposer({ copyOf: a })}
              onSend={() => setToSend(a)}
              onDelete={() => setToDelete(a)}
            />
          ))}
        </ul>
      )}

      <AnnouncementComposer
        courseId={courseId}
        state={composer}
        onClose={() => setComposer(null)}
        learners={approved.data ?? []}
        learnersLoading={approved.isPending}
      />

      <ConfirmDialog
        open={!!toSend}
        onOpenChange={(o) => !o && setToSend(null)}
        title={tc("sendTitle")}
        description={toSend ? tc("sendText", { count: toSend.recipientCount, email: String(toSend.sendEmail) }) : undefined}
        confirmLabel={toSend && toSend.recipientCount > 0 ? tc("sendConfirm", { count: toSend.recipientCount }) : tc("sendNow")}
        loading={send.isPending}
        onConfirm={() => {
          if (!toSend) return;
          send.mutate(toSend.id, {
            onSuccess: (a) => {
              toast.success(tc("sentToast", { count: a.recipientCount }));
              setToSend(null);
            },
            onError: () => setToSend(null),
          });
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete ? t("deleteTitle", { title: toDelete.title }) : ""}
        description={t("deleteText")}
        confirmLabel={t("delete")}
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setToDelete(null);
            },
          });
        }}
      />
    </div>
  );
}
