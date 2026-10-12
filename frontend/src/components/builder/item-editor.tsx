"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart3, ChevronRight, ClipboardList, Eye, FileText, Inbox, Info, Lock, Save, Trash } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ContentItemDto, ItemType, ItemUpsert, MediaDto } from "@/lib/api/types";
import { isApiError } from "@/lib/api/client";
import { ITEM_TYPES, ITEM_TYPE_META, isAssessmentType } from "@/lib/constants";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { getEmbedInfo } from "@/lib/embed";
import { applyServerErrors } from "@/lib/form-errors";
import { useDeleteItem, useInstructorCourse, useInstructorItem, usePublishItem, useUpdateItem } from "@/hooks/queries/instructor";
import { useHotkey } from "@/hooks/use-hotkey";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { PageContainer } from "@/components/layout/page-header";
import { VisibilityBadge } from "@/components/course/badges";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { EmbedFrame } from "@/components/learn/viewers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AssessmentEditor } from "./assessment-editor";
import { AttachmentsManager } from "./attachments-manager";
import { PublicationForm } from "./publication-control";
import { ItemReleasePanel } from "./release-rules-panel";
import { RichTextEditor } from "./rich-text-editor";
import { SubmissionsPanel } from "./submissions-panel";
import { AssessmentAnalytics } from "@/components/reports/assessment-analytics";

type SchemaT = (key: "validation.titleRequired" | "validation.tooLong" | "validation.url" | "validation.wholeNumber") => string;

const makeSchema = (t: SchemaT) =>
  z.object({
    title: z.string().trim().min(1, t("validation.titleRequired")).max(200, t("validation.tooLong")),
    type: z.enum(["TEXT", "DOCUMENT", "VIDEO", "AUDIO", "IMAGE", "EMBED", "QUIZ", "EXAM"]),
    summary: z.string().max(1000, t("validation.tooLong")),
    body: z.string(),
    externalUrl: z
      .string()
      .trim()
      .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), t("validation.url")),
    durationMinutes: z.string().regex(/^\d*$/, t("validation.wholeNumber")),
    attachments: z.array(z.custom<MediaDto>()),
  });
type Values = z.infer<ReturnType<typeof makeSchema>>;

const toValues = (item: ContentItemDto): Values => ({
  title: item.title,
  type: item.type,
  summary: item.summary ?? "",
  body: item.body ?? "",
  externalUrl: item.externalUrl ?? "",
  durationMinutes: item.durationMinutes != null ? String(item.durationMinutes) : "",
  attachments: item.attachments,
});

const toUpsert = (v: Values): ItemUpsert => ({
  type: v.type,
  title: v.title.trim(),
  summary: v.summary.trim() || null,
  body: v.body || null,
  externalUrl: v.externalUrl.trim() || null,
  durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
  attachmentIds: v.attachments.map((a) => a.id),
});

const HINT_TYPES = ["VIDEO", "AUDIO", "IMAGE", "DOCUMENT"] as const;
type HintType = (typeof HINT_TYPES)[number];
const hasHint = (type: ItemType): type is HintType => (HINT_TYPES as readonly string[]).includes(type);

function EditorSkeleton() {
  return (
    <PageContainer wide>
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-4 h-9 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </PageContainer>
  );
}

type EditorTab = "content" | "release" | "assessment" | "submissions" | "analytics";

function ItemEditorLoaded({
  item,
  courseTitle,
  moduleTitle,
  initialTab,
  initialAttemptId,
}: {
  item: ContentItemDto;
  courseTitle?: string;
  moduleTitle?: string;
  initialTab: EditorTab;
  initialAttemptId: string | null;
}) {
  const router = useRouter();
  const t = useTranslations();
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const schema = React.useMemo(() => makeSchema((k) => t(k)), [t]);
  const update = useUpdateItem(item.courseId);
  const publish = usePublishItem(item.courseId);
  const del = useDeleteItem(item.courseId);
  const [tab, setTab] = React.useState<EditorTab>(isAssessmentType(item.type) || initialTab === "release" ? initialTab : "content");
  const [assessmentDirty, setAssessmentDirty] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const values = React.useMemo(() => toValues(item), [item]);
  const form = useForm<Values>({ resolver: zodResolver(schema), values });
  const { errors, isDirty, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });
  const title = useWatch({ control: form.control, name: "title" });
  const externalUrl = useWatch({ control: form.control, name: "externalUrl" });
  useUnsavedChanges((isDirty && !isSubmitting) || assessmentDirty);

  const save = form.handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ id: item.id, body: toUpsert(v) });
      toast.success(t("common.saved"));
    } catch (err) {
      if (!applyServerErrors(err, form.setError, ["title", "type", "summary", "body", "externalUrl", "durationMinutes"])) {
        toast.error(errorMessage(err));
      }
    }
  });
  useHotkey(
    "mod+s",
    (e) => {
      e.preventDefault();
      void save();
    },
    { enabled: tab === "content" },
  );

  const assessmentSaved = isAssessmentType(item.type);
  const showUrl = type === "VIDEO" || type === "EMBED";
  const embed = getEmbedInfo(externalUrl);

  return (
    <PageContainer wide>
      <nav aria-label={t("builder.breadcrumb")} className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="shrink-0 hover:text-foreground">
          {t("builder.courses")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link href={`/instructor/courses/${item.courseId}`} className="truncate hover:text-foreground">
          {courseTitle ?? t("itemEditor.course")}
        </Link>
        {moduleTitle && (
          <>
            <ChevronRight className="size-3.5 shrink-0" />
            <span className="hidden truncate sm:inline">{moduleTitle}</span>
          </>
        )}
      </nav>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <ItemTypeIcon type={type} className="size-10" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title || t("itemEditor.untitled")}</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <VisibilityBadge visibility={item.visibility} publishAt={item.publishAt} unpublishAt={item.unpublishAt} compact />
              <span>{t("itemEditor.savedAgo", { when: fmt.relative(item.updatedAt) })}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.visibility === "LIVE" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/learn/${item.courseId}/${item.id}`}>
                <Eye /> {t("common.preview")}
              </Link>
            </Button>
          )}
          {tab === "content" && (
            <Button onClick={() => void save()} loading={isSubmitting} disabled={!isDirty}>
              <Save /> {t("common.save")}
              <Kbd className="ml-1 hidden border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/80 sm:inline-flex">⌘S</Kbd>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EditorTab)} className="min-w-0">
          <TabsList variant="underline">
            <TabsTrigger value="content">
              <FileText /> {t("itemEditor.content")} {isDirty && <span className="size-1.5 rounded-full bg-brand" aria-label={t("itemEditor.unsaved")} />}
            </TabsTrigger>
            <TabsTrigger value="release">
              <Lock /> {t("release.tab")}
            </TabsTrigger>
            {isAssessmentType(type) && (
              <>
                <TabsTrigger value="assessment">
                  <ClipboardList /> {t("itemEditor.assessment")} {assessmentDirty && <span className="size-1.5 rounded-full bg-brand" aria-label={t("itemEditor.unsaved")} />}
                </TabsTrigger>
                <TabsTrigger value="submissions">
                  <Inbox /> {t("itemEditor.submissions")}
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  <BarChart3 /> {t("itemEditor.analytics")}
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="content" className="mt-6">
            <form onSubmit={save} className="grid gap-6" noValidate>
              <Card>
                <CardContent className="grid gap-5 pt-5 sm:pt-6">
                  <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
                    <Field label={t("itemEditor.title")} htmlFor="title" error={errors.title?.message} required>
                      <Input {...fieldA11y("title", errors.title?.message)} {...form.register("title")} />
                    </Field>
                    <Field label={t("itemEditor.type")} htmlFor="type">
                      <Controller
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPES.map((it) => {
                                const Icon = ITEM_TYPE_META[it].icon;
                                return (
                                  <SelectItem key={it} value={it}>
                                    <span className="flex items-center gap-2">
                                      <Icon className="size-4 text-muted-foreground" /> {t(`itemTypes.${it}.label`)}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </div>
                  {isAssessmentType(type) && !assessmentSaved && (
                    <p className="rounded-lg border border-info/25 bg-info-soft/50 px-3 py-2 text-[13px] text-info">
                      {t("itemEditor.becomeAssessment", { kind: type === "EXAM" ? t("itemEditor.examWord") : t("itemEditor.quizWord") })}
                    </p>
                  )}
                  <Field label={t("itemEditor.summary")} htmlFor="summary" error={errors.summary?.message} hint={t("itemEditor.summaryHint")}>
                    <Textarea rows={2} {...fieldA11y("summary", errors.summary?.message)} {...form.register("summary")} />
                  </Field>
                  {showUrl && (
                    <Field
                      label={type === "VIDEO" ? t("itemEditor.videoUrl") : t("itemEditor.externalUrl")}
                      htmlFor="externalUrl"
                      error={errors.externalUrl?.message}
                      hint={embed?.embedUrl ? t("itemEditor.embedDetected", { provider: embed.label }) : undefined}
                    >
                      <Input type="url" placeholder="https://" {...fieldA11y("externalUrl", errors.externalUrl?.message)} {...form.register("externalUrl")} />
                    </Field>
                  )}
                  {showUrl && embed && !embed.embedUrl && !errors.externalUrl && <EmbedLinkNote host={embed.label} />}
                  {showUrl && embed && !errors.externalUrl && <EmbedFrame url={externalUrl} title={title} className="max-w-2xl" />}
                  <Field label={t("itemEditor.duration")} htmlFor="durationMinutes" error={errors.durationMinutes?.message} className="max-w-48">
                    <div className="relative">
                      <Input type="number" min={0} inputMode="numeric" className="pr-12" {...fieldA11y("durationMinutes", errors.durationMinutes?.message)} {...form.register("durationMinutes")} />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{t("common.min")}</span>
                    </div>
                  </Field>
                </CardContent>
              </Card>

              <section className="grid gap-2" aria-label={t("itemEditor.bodyAria")}>
                <h2 className="text-sm font-semibold">{isAssessmentType(type) ? t("itemEditor.introduction") : t("itemEditor.lessonContent")}</h2>
                <Controller control={form.control} name="body" render={({ field }) => (
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={isAssessmentType(type) ? t("itemEditor.introPlaceholder") : undefined}
                    />
                  )} />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle>{t("itemEditor.attachments")}</CardTitle>
                  <CardDescription>
                    {t("itemEditor.attachmentsText")} {hasHint(type) ? t(`itemEditor.hints.${type}`) : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Controller
                    control={form.control}
                    name="attachments"
                    render={({ field }) => (
                      <AttachmentsManager
                        value={field.value}
                        onChange={(next) => form.setValue("attachments", next, { shouldDirty: true })}
                        onAppend={(media) =>
                          form.setValue("attachments", [...form.getValues("attachments"), media], { shouldDirty: true })
                        }
                        hint={hasHint(type) ? t(`itemEditor.hints.${type}`) : undefined}
                      />
                    )}
                  />
                </CardContent>
              </Card>
              {isDirty && (
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/85 py-3 backdrop-blur">
                  <span className="mr-auto text-xs text-muted-foreground">{t("common.unsavedChanges")}</span>
                  <Button type="button" variant="ghost" onClick={() => form.reset(values)}>
                    {t("common.discard")}
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    {t("common.saveChanges")}
                  </Button>
                </div>
              )}
            </form>
          </TabsContent>

          <TabsContent value="release" className="mt-6">
            <ItemReleasePanel item={item} />
          </TabsContent>

          {isAssessmentType(type) && (
            <>
              <TabsContent value="assessment" className="mt-6">
                {assessmentSaved ? (
                  <AssessmentEditor itemId={item.id} courseId={item.courseId} active={tab === "assessment"} onDirtyChange={setAssessmentDirty} />
                ) : (
                  <EmptyState icon={ClipboardList} title={t("itemEditor.saveFirst")} description={t("itemEditor.saveFirstText")} />
                )}
              </TabsContent>
              <TabsContent value="submissions" className="mt-6">
                {assessmentSaved ? <SubmissionsPanel itemId={item.id} initialAttemptId={initialAttemptId} /> : null}
              </TabsContent>
              <TabsContent value="analytics" className="mt-6">
                {assessmentSaved ? <AssessmentAnalytics itemId={item.id} active={tab === "analytics"} /> : null}
              </TabsContent>
            </>
          )}
        </Tabs>

        <aside className="grid content-start gap-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{t("itemEditor.publication")}</CardTitle>
                <VisibilityBadge visibility={item.visibility} publishAt={item.publishAt} unpublishAt={item.unpublishAt} compact />
              </div>
              <CardDescription>{t(`visibility.${item.visibility}.description`)}</CardDescription>
            </CardHeader>
            <CardContent>
              <PublicationForm
                key={`${item.publishStatus}-${item.publishAt}-${item.unpublishAt}`}
                entity={item}
                entityLabel="item"
                pending={publish.isPending}
                onSubmit={(body) =>
                  publish.mutateAsync({ id: item.id, body }).then((i) => {
                    toast.success(t("itemEditor.nowIs", { status: t(`visibility.${i.visibility}.label`) }));
                    return i;
                  })
                }
              />
              <p className="mt-3 text-[11px] text-muted-foreground">{t("itemEditor.learnersNote")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-2 pt-5 text-sm sm:pt-6">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("itemEditor.created")}</span>
                <span>{fmt.dateTime(item.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("itemEditor.lastSaved")}</span>
                <span>{fmt.dateTime(item.updatedAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("itemEditor.attachmentCount")}</span>
                <span className="tabular-nums">{item.attachments.length}</span>
              </div>
              <Button variant="destructive-ghost" size="sm" className="mt-2 justify-start" onClick={() => setDeleteOpen(true)}>
                <Trash /> {t("itemEditor.deleteItem")}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("builder.deleteTitle", { title: item.title })}
        description={t("itemEditor.deleteText")}
        confirmLabel={t("common.delete")}
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(item.id, {
            onSuccess: () => {
              toast.success(t("builder.itemDeleted"));
              form.reset(values);
              router.push(`/instructor/courses/${item.courseId}`);
            },
          })
        }
      />
    </PageContainer>
  );
}

export function ItemEditor() {
  const { courseId, itemId } = useParams<{ courseId: string; itemId: string }>();
  const item = useInstructorItem(itemId);
  const course = useInstructorCourse(courseId);
  const t = useTranslations("itemEditor");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: EditorTab = tabParam === "assessment" || tabParam === "submissions" || tabParam === "analytics" || tabParam === "release" ? tabParam : "content";
  const initialAttemptId = searchParams.get("attempt");

  if (item.isPending) return <EditorSkeleton />;
  if (item.isError) {
    const missing = isApiError(item.error) && (item.error.status === 404 || item.error.status === 403);
    return (
      <PageContainer>
        {missing ? (
          <EmptyState
            icon={FileText}
            title={t("notFound")}
            description={t("notFoundText")}
            action={
              <Button asChild>
                <Link href={`/instructor/courses/${courseId}`}>{t("backToCourse")}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={item.error} onRetry={() => item.refetch()} />
        )}
      </PageContainer>
    );
  }
  const moduleTitle = course.data?.modules.find((m) => m.id === item.data.moduleId)?.title;
  return (
    <ItemEditorLoaded
      item={item.data}
      courseTitle={course.data?.title}
      moduleTitle={moduleTitle}
      initialTab={initialTab}
      initialAttemptId={initialAttemptId}
    />
  );
}

/** Shown for URLs we cannot embed: most sites forbid framing, so learners get a link card instead. */
export function EmbedLinkNote({ host, className }: { host: string; className?: string }) {
  const t = useTranslations("itemEditor");
  return (
    <p role="note" className={cn("flex max-w-2xl gap-2.5 rounded-lg border border-info/25 bg-info-soft/50 px-3 py-2.5 text-[13px] text-info", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-medium">{t("linkCardTitle", { host })}</span> {t("linkCardText")}
      </span>
    </p>
  );
}
