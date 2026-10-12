"use client";

import * as React from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AttendanceStatus, LiveSessionDto } from "@/lib/api/types";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useAttendance, useSaveAttendance } from "@/hooks/queries/practice";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];
const NONE = "none";

function Sheet_({ courseId, session, onClose }: { courseId: string; session: LiveSessionDto; onClose: () => void }) {
  const t = useTranslations("live");
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const sheet = useAttendance(session.id);
  const save = useSaveAttendance(courseId, session.id);
  const [draft, setDraft] = React.useState<Record<string, AttendanceStatus>>({});
  const rows = sheet.data?.rows ?? [];
  const valueOf = (id: string, current: AttendanceStatus | null) => draft[id] ?? current ?? null;
  const dirty = Object.keys(draft).length > 0;
  const allPresent = () => setDraft(Object.fromEntries(rows.map((r) => [r.student.id, "PRESENT" as const])));

  const submit = () => {
    const entries = Object.entries(draft).map(([studentId, status]) => ({ studentId, status }));
    if (entries.length === 0) return;
    save.mutate(entries, {
      onSuccess: () => {
        toast.success(t("attendanceSaved"));
        onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("attendanceTitle")}</SheetTitle>
        <SheetDescription>
          {session.title} · {fmt.dateTime(session.startsAt)}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {sheet.isPending ? (
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : sheet.isError ? (
          <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState compact title={t("noLearnersTitle")} description={t("noLearnersText")} />
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={allPresent} className="mb-3">
              <CheckCheck /> {t("allPresent")}
            </Button>
            <ul className="grid gap-1.5 pb-4">
              {rows.map((r) => {
                const value = valueOf(r.student.id, r.status);
                return (
                  <li key={r.student.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                    <UserAvatar name={r.student.fullName} src={r.student.avatarUrl} className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.student.fullName}</span>
                    <Select
                      value={value ?? NONE}
                      onValueChange={(v) => v !== NONE && setDraft((d) => ({ ...d, [r.student.id]: v as AttendanceStatus }))}
                    >
                      <SelectTrigger size="sm" className="w-36" aria-label={t("attendanceFor", { name: r.student.fullName })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} disabled>
                          {t("notRecorded")}
                        </SelectItem>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`attendance.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <SheetFooter className="border-t p-4">
        <Button variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button onClick={submit} loading={save.isPending} disabled={!dirty}>
          {t("saveAttendance")}
        </Button>
      </SheetFooter>
    </>
  );
}

export function AttendanceSheet({ courseId, session, onClose }: { courseId: string; session: LiveSessionDto | null; onClose: () => void }) {
  return (
    <Sheet open={!!session} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0" aria-describedby={undefined}>
        {session && <Sheet_ key={session.id} courseId={courseId} session={session} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}
