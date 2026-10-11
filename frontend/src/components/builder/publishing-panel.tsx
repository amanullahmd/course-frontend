"use client";

import { CircleCheck, CircleDashed, Info } from "lucide-react";
import { toast } from "sonner";
import type { CourseDto } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { usePublishCourse } from "@/hooks/queries/instructor";
import { VisibilityBadge } from "@/components/course/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicationForm } from "./publication-control";

function Check({ ok, label, hint, optional }: { ok: boolean; label: string; hint?: string; optional?: boolean }) {
  const t = useTranslations("common");
  return (
    <li className="flex items-start gap-3">
      {ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed className={cn("mt-0.5 size-4 shrink-0", optional ? "text-muted-foreground" : "text-warning")} />
      )}
      <div>
        <p className={cn("text-sm", ok ? "text-foreground" : "font-medium")}>
          {label}
          {optional && <span className="ml-1 text-xs font-normal text-muted-foreground">({t("optional")})</span>}
        </p>
        {hint && !ok && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </li>
  );
}

export function PublishingPanel({ course }: { course: CourseDto }) {
  const t = useTranslations();
  const fmt = useFormat();
  const publish = usePublishCourse(course.id);
  const items = course.modules.flatMap((m) => m.items);
  const liveModules = course.modules.filter((m) => m.visibility === "LIVE");
  const liveItems = course.modules.filter((m) => m.visibility === "LIVE").flatMap((m) => m.items.filter((i) => i.visibility === "LIVE"));
  const scheduled = [
    ...course.modules.filter((m) => m.visibility === "SCHEDULED").map((m) => ({ id: m.id, title: m.title, kind: t("publishing.module"), at: m.publishAt })),
    ...items.filter((i) => i.visibility === "SCHEDULED").map((i) => ({ id: i.id, title: i.title, kind: t("publishing.lesson"), at: i.publishAt })),
  ].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("publishing.visibility")}</CardTitle>
              <VisibilityBadge visibility={course.visibility} publishAt={course.publishAt} unpublishAt={course.unpublishAt} />
            </div>
            <CardDescription>{t(`visibility.${course.visibility}.description`)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <PublicationForm
                key={`${course.publishStatus}-${course.publishAt}-${course.unpublishAt}`}
                entity={course}
                entityLabel="course"
                pending={publish.isPending}
                onSubmit={(body) =>
                  publish.mutateAsync(body).then((c) => {
                    toast.success(t("publishing.nowIs", { status: t(`visibility.${c.visibility}.label`) }));
                    return c;
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 text-info" /> {t("publishing.howTitle")}
            </CardTitle>
            <CardDescription>{t("publishing.howText")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[t("publishing.courseLive"), t("publishing.moduleLive"), t("publishing.lessonLive")].map((label, i) => (
                <span key={label} className="flex items-center gap-2">
                  <span className="rounded-lg border bg-success-soft/50 px-3 py-1.5 font-medium text-success">{label}</span>
                  {i < 2 && <span className="font-mono text-muted-foreground">&amp;&amp;</span>}
                </span>
              ))}
              <span className="font-mono text-muted-foreground">⇒</span>
              <span className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground">{t("publishing.learnersSee")}</span>
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {(["DRAFT", "SCHEDULED", "LIVE", "EXPIRED"] as const).map((v) => (
                <li key={v} className="flex items-start gap-2">
                  <VisibilityBadge visibility={v} />
                  <span className="text-[13px]">{t(`visibility.${v}.description`)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted-foreground">{t("publishing.rule")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("publishing.checklist")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              <Check ok={!!course.title && !!course.description} label={t("publishing.c1")} hint={t("publishing.c1Hint")} />
              <Check ok={!!course.coverImage} label={t("publishing.c2")} optional />
              <Check ok={course.modules.length > 0} label={t("publishing.c3")} hint={t("publishing.c3Hint")} />
              <Check ok={items.length > 0} label={t("publishing.c4")} />
              <Check ok={liveModules.length > 0} label={t("publishing.c5")} hint={t("publishing.c5Hint")} />
              <Check ok={liveItems.length > 0} label={t("publishing.c6")} />
              <Check ok={course.visibility === "LIVE"} label={t("publishing.c7")} hint={t("publishing.c7Hint")} />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("publishing.upcoming")}</CardTitle>
            <CardDescription>{t("publishing.upcomingText")}</CardDescription>
          </CardHeader>
          <CardContent>
            {scheduled.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("publishing.nothing")}</p>
            ) : (
              <ul className="grid gap-2.5">
                {scheduled.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{s.kind}</span>
                    </span>
                    <span className="shrink-0 text-xs text-info tabular-nums">{fmt.dateTime(s.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
