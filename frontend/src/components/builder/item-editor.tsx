"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ClipboardList, Eye, FileText, Inbox, Save, Trash } from "lucide-react";
import { toast } from "sonner";
import type { ContentItemDto, ItemType, ItemUpsert, MediaDto } from "@/lib/api/types";
import { getErrorMessage, isApiError } from "@/lib/api/client";
import { ITEM_TYPES, ITEM_TYPE_META, VISIBILITY_META, isAssessmentType } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/dates";
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
import { RichTextEditor } from "./rich-text-editor";
import { SubmissionsPanel } from "./submissions-panel";

const schema = z.object({
  title: z.string().trim().min(1, "Give this item a title").max(200),
  type: z.enum(["TEXT", "DOCUMENT", "VIDEO", "AUDIO", "IMAGE", "EMBED", "QUIZ", "EXAM"]),
  summary: z.string().max(1000),
  body: z.string(),
  externalUrl: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Enter a full URL starting with https://"),
  durationMinutes: z.string().regex(/^\d*$/, "Minutes as a whole number"),
  attachments: z.array(z.custom<MediaDto>()),
});
type Values = z.infer<typeof schema>;

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

const UPLOAD_HINTS: Partial<Record<ItemType, { accept?: string; hint: string }>> = {
  VIDEO: { accept: "video/*", hint: "MP4, WebM or MOV. Or paste a YouTube/Vimeo link above." },
  AUDIO: { accept: "audio/*", hint: "MP3, M4A, WAV or OGG for listening practice." },
  IMAGE: { accept: "image/*", hint: "JPG, PNG, WebP or SVG. Shown as a gallery with lightbox." },
  DOCUMENT: { hint: "PDF is shown inline; Word, PowerPoint, Excel and other files can be downloaded." },
};

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

function ItemEditorLoaded({ item, courseTitle, moduleTitle }: { item: ContentItemDto; courseTitle?: string; moduleTitle?: string }) {
  const router = useRouter();
  const update = useUpdateItem(item.courseId);
  const publish = usePublishItem(item.courseId);
  const del = useDeleteItem(item.courseId);
  const [tab, setTab] = React.useState<"content" | "assessment" | "submissions">("content");
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
      toast.success("Saved");
    } catch (err) {
      if (!applyServerErrors(err, form.setError, ["title", "type", "summary", "body", "externalUrl", "durationMinutes"])) {
        toast.error(getErrorMessage(err));
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
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="shrink-0 hover:text-foreground">
          Courses
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link href={`/instructor/courses/${item.courseId}`} className="truncate hover:text-foreground">
          {courseTitle ?? "Course"}
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
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title || "Untitled"}</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <VisibilityBadge visibility={item.visibility} publishAt={item.publishAt} unpublishAt={item.unpublishAt} compact />
              <span>Saved {formatRelative(item.updatedAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.visibility === "LIVE" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/learn/${item.courseId}/${item.id}`}>
                <Eye /> Preview
              </Link>
            </Button>
          )}
          {tab === "content" && (
            <Button onClick={() => void save()} loading={isSubmitting} disabled={!isDirty}>
              <Save /> Save
              <Kbd className="ml-1 hidden border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/80 sm:inline-flex">⌘S</Kbd>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="min-w-0">
          <TabsList variant="underline">
            <TabsTrigger value="content">
              <FileText /> Content {isDirty && <span className="size-1.5 rounded-full bg-brand" aria-label="unsaved" />}
            </TabsTrigger>
            {isAssessmentType(type) && (
              <>
                <TabsTrigger value="assessment">
                  <ClipboardList /> Assessment {assessmentDirty && <span className="size-1.5 rounded-full bg-brand" aria-label="unsaved" />}
                </TabsTrigger>
                <TabsTrigger value="submissions">
                  <Inbox /> Submissions
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="content" className="mt-6">
            <form onSubmit={save} className="grid gap-6" noValidate>
              <Card>
                <CardContent className="grid gap-5 pt-5 sm:pt-6">
                  <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
                    <Field label="Title" htmlFor="title" error={errors.title?.message} required>
                      <Input {...fieldA11y("title", errors.title?.message)} {...form.register("title")} />
                    </Field>
                    <Field label="Type" htmlFor="type">
                      <Controller
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPES.map((t) => {
                                const Icon = ITEM_TYPE_META[t].icon;
                                return (
                                  <SelectItem key={t} value={t}>
                                    <span className="flex items-center gap-2">
                                      <Icon className="size-4 text-muted-foreground" /> {ITEM_TYPE_META[t].label}
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
                      Save to turn this item into a {type === "EXAM" ? "exam" : "quiz"}, then add questions in the Assessment tab.
                    </p>
                  )}
                  <Field label="Summary" htmlFor="summary" error={errors.summary?.message} hint="Short intro shown above the content.">
                    <Textarea rows={2} {...fieldA11y("summary", errors.summary?.message)} {...form.register("summary")} />
                  </Field>
                  {showUrl && (
                    <Field
                      label={type === "VIDEO" ? "Video link (YouTube or Vimeo)" : "External URL"}
                      htmlFor="externalUrl"
                      error={errors.externalUrl?.message}
                      hint={embed ? (embed.embedUrl ? `${embed.label} embed detected` : "This link will be shown as a link card.") : undefined}
                    >
                      <Input type="url" placeholder="https://" {...fieldA11y("externalUrl", errors.externalUrl?.message)} {...form.register("externalUrl")} />
                    </Field>
                  )}
                  {showUrl && embed && !errors.externalUrl && <EmbedFrame url={externalUrl} title={title} className="max-w-2xl" />}
                  <Field label="Estimated duration" htmlFor="durationMinutes" error={errors.durationMinutes?.message} className="max-w-48">
                    <div className="relative">
                      <Input type="number" min={0} inputMode="numeric" className="pr-12" {...fieldA11y("durationMinutes", errors.durationMinutes?.message)} {...form.register("durationMinutes")} />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                    </div>
                  </Field>
                </CardContent>
              </Card>

              <section className="grid gap-2" aria-label="Lesson body">
                <h2 className="text-sm font-semibold">{isAssessmentType(type) ? "Introduction" : "Lesson content"}</h2>
                <Controller control={form.control} name="body" render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />} />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle>Attachments</CardTitle>
                  <CardDescription>
                    Upload any file type with drag & drop. Drag rows to reorder. {UPLOAD_HINTS[type]?.hint ?? ""}
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
                        hint={UPLOAD_HINTS[type]?.hint}
                      />
                    )}
                  />
                </CardContent>
              </Card>
              {isDirty && (
                <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/85 py-3 backdrop-blur">
                  <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>
                  <Button type="button" variant="ghost" onClick={() => form.reset(values)}>
                    Discard
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    Save changes
                  </Button>
                </div>
              )}
            </form>
          </TabsContent>

          {isAssessmentType(type) && (
            <>
              <TabsContent value="assessment" className="mt-6">
                {assessmentSaved ? (
                  <AssessmentEditor itemId={item.id} courseId={item.courseId} active={tab === "assessment"} onDirtyChange={setAssessmentDirty} />
                ) : (
                  <EmptyState icon={ClipboardList} title="Save the item first" description="Save the type change on the Content tab to start adding questions." />
                )}
              </TabsContent>
              <TabsContent value="submissions" className="mt-6">
                {assessmentSaved ? <SubmissionsPanel itemId={item.id} /> : null}
              </TabsContent>
            </>
          )}
        </Tabs>

        <aside className="grid content-start gap-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Publication</CardTitle>
                <VisibilityBadge visibility={item.visibility} publishAt={item.publishAt} unpublishAt={item.unpublishAt} compact />
              </div>
              <CardDescription>{VISIBILITY_META[item.visibility].description}</CardDescription>
            </CardHeader>
            <CardContent>
              <PublicationForm
                key={`${item.publishStatus}-${item.publishAt}-${item.unpublishAt}`}
                entity={item}
                entityLabel="item"
                pending={publish.isPending}
                onSubmit={(body) =>
                  publish.mutateAsync({ id: item.id, body }).then((i) => {
                    toast.success(`Item is now ${VISIBILITY_META[i.visibility].label.toLowerCase()}`);
                    return i;
                  })
                }
              />
              <p className="mt-3 text-[11px] text-muted-foreground">Learners see it only when the course and module are live too.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-2 pt-5 text-sm sm:pt-6">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Last saved</span>
                <span>{formatDateTime(item.updatedAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Attachments</span>
                <span className="tabular-nums">{item.attachments.length}</span>
              </div>
              <Button variant="destructive-ghost" size="sm" className="mt-2 justify-start" onClick={() => setDeleteOpen(true)}>
                <Trash /> Delete item
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${item.title}”?`}
        description="This removes the item and all learner progress and attempts for it. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(item.id, {
            onSuccess: () => {
              toast.success("Item deleted");
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

  if (item.isPending) return <EditorSkeleton />;
  if (item.isError) {
    const missing = isApiError(item.error) && (item.error.status === 404 || item.error.status === 403);
    return (
      <PageContainer>
        {missing ? (
          <EmptyState
            icon={FileText}
            title="Item not found"
            description="It may have been deleted."
            action={
              <Button asChild>
                <Link href={`/instructor/courses/${courseId}`}>Back to course</Link>
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
  return <ItemEditorLoaded item={item.data} courseTitle={course.data?.title} moduleTitle={moduleTitle} />;
}
