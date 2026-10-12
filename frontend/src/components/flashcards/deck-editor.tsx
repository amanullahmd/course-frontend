"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Ellipsis, Download, FileUp, ImageIcon, ListPlus, Music, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { DeckDto, FlashcardArticle, FlashcardUpsert, MediaDto } from "@/lib/api/types";
import { flashcardsApi } from "@/lib/api/practice";
import { mediaApi } from "@/lib/api/media";
import { isApiError } from "@/lib/api/client";
import { ARTICLES, type DraftRow } from "@/lib/flashcards";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useDeck, useSaveDeck } from "@/hooks/queries/practice";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { BulkAddDialog } from "./bulk-add-dialog";
import { CsvImportDialog } from "./csv-import-dialog";

const MAX_CARDS = 2000;
const NO_ARTICLE = "none";

interface Row {
  key: string;
  id: string | null;
  front: string;
  back: string;
  article: FlashcardArticle | "";
  plural: string;
  example: string;
  audio: MediaDto | null;
  image: MediaDto | null;
}

let counter = 0;
const nextKey = () => `row-${(counter += 1)}`;

const fromDeck = (deck: DeckDto): Row[] =>
  deck.cards.map((c) => ({
    key: nextKey(),
    id: c.id,
    front: c.front,
    back: c.back,
    article: c.article ?? "",
    plural: c.plural ?? "",
    example: c.example ?? "",
    audio: c.audio,
    image: c.image,
  }));

const signature = (rows: Row[]) =>
  JSON.stringify(rows.map((r) => [r.id, r.front, r.back, r.article, r.plural, r.example, r.audio?.id ?? null, r.image?.id ?? null]));

const toUpsert = (r: Row): FlashcardUpsert => ({
  id: r.id,
  front: r.front,
  back: r.back,
  article: r.article || null,
  plural: r.plural || null,
  example: r.example || null,
  audioMediaId: r.audio?.id ?? null,
  imageMediaId: r.image?.id ?? null,
});

function MediaSlot({
  kind,
  media,
  onChange,
}: {
  kind: "audio" | "image";
  media: MediaDto | null;
  onChange: (media: MediaDto | null) => void;
}) {
  const t = useTranslations("flashcards");
  const errorMessage = useErrorMessage();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const Icon = kind === "audio" ? Music : ImageIcon;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await mediaApi.upload(file));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {media ? (
        <>
          <span className="min-w-0 flex-1 truncate text-sm" title={media.fileName}>
            {media.fileName}
          </span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange(null)} aria-label={t(kind === "audio" ? "removeAudio" : "removeImage")}>
            <X />
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" size="xs" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Spinner className="size-3" /> : <FileUp />} {t(kind === "audio" ? "addAudio" : "addImage")}
        </Button>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={kind === "audio" ? "audio/*" : "image/*"}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const CardRow = React.memo(function CardRow({
  row,
  index,
  total,
  error,
  onChange,
  onMove,
  onRemove,
}: {
  row: Row;
  index: number;
  total: number;
  error?: Record<string, string>;
  onChange: (key: string, patch: Partial<Row>) => void;
  onMove: (key: string, delta: -1 | 1) => void;
  onRemove: (key: string) => void;
}) {
  const t = useTranslations("flashcards");
  const [open, setOpen] = React.useState(!!(row.example || row.audio || row.image));
  const n = index + 1;
  return (
    <li className={cn("rounded-xl border bg-card p-3 shadow-xs", error && "border-destructive/50")} data-testid="deck-row">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-[2rem_minmax(0,1.3fr)_6rem_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] md:items-start">
        <span className="hidden pt-2 text-xs text-muted-foreground tabular-nums md:block">{n}</span>
        <div className="order-1 col-span-2 md:order-none md:col-span-1">
          <label className="mb-1 block text-xs text-muted-foreground md:sr-only" htmlFor={`front-${row.key}`}>
            {t("front")} {n}
          </label>
          <Input id={`front-${row.key}`} value={row.front} maxLength={500} aria-invalid={!!error?.front || undefined} onChange={(e) => onChange(row.key, { front: e.target.value })} lang="de" />
        </div>
        <div className="order-3 md:order-none">
          <label className="mb-1 block text-xs text-muted-foreground md:sr-only" htmlFor={`article-${row.key}`}>
            {t("article")} {n}
          </label>
          <Select
            value={row.article || NO_ARTICLE}
            onValueChange={(v) => onChange(row.key, { article: v === NO_ARTICLE ? "" : (v as FlashcardArticle) })}
          >
            <SelectTrigger id={`article-${row.key}`} aria-invalid={!!error?.article || undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ARTICLE}>{t("noArticle")}</SelectItem>
              {ARTICLES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="order-2 col-span-2 md:order-none md:col-span-1">
          <label className="mb-1 block text-xs text-muted-foreground md:sr-only" htmlFor={`back-${row.key}`}>
            {t("back")} {n}
          </label>
          <Input id={`back-${row.key}`} value={row.back} maxLength={500} aria-invalid={!!error?.back || undefined} onChange={(e) => onChange(row.key, { back: e.target.value })} />
        </div>
        <div className="order-4 md:order-none">
          <label className="mb-1 block text-xs text-muted-foreground md:sr-only" htmlFor={`plural-${row.key}`}>
            {t("plural")} {n}
          </label>
          <Input id={`plural-${row.key}`} value={row.plural} maxLength={200} onChange={(e) => onChange(row.key, { plural: e.target.value })} lang="de" />
        </div>
        <div className="order-5 col-span-2 flex items-center justify-end gap-0.5 md:order-none md:col-span-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("moreFields", { n })}>
            <Ellipsis className={cn(open && "text-brand-strong")} />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(row.key, -1)} disabled={index === 0} aria-label={t("moveUp", { n })}>
            <ChevronUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(row.key, 1)} disabled={index === total - 1} aria-label={t("moveDown", { n })}>
            <ChevronDown />
          </Button>
          <Button type="button" variant="destructive-ghost" size="icon-sm" onClick={() => onRemove(row.key)} aria-label={t("removeCard", { n })}>
            <Trash2 />
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-[1fr_auto_auto] md:items-center md:pl-8">
          <Input value={row.example} maxLength={1000} placeholder={t("example")} aria-label={`${t("example")} ${n}`} onChange={(e) => onChange(row.key, { example: e.target.value })} lang="de" />
          <MediaSlot kind="audio" media={row.audio} onChange={(audio) => onChange(row.key, { audio })} />
          <MediaSlot kind="image" media={row.image} onChange={(image) => onChange(row.key, { image })} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {Object.values(error).join(" · ")}
        </p>
      )}
    </li>
  );
});

function Editor({ itemId, deck }: { itemId: string; deck: DeckDto }) {
  const t = useTranslations("flashcards");
  const errorMessage = useErrorMessage();
  const save = useSaveDeck(itemId);
  const [rows, setRows] = React.useState<Row[]>(() => fromDeck(deck));
  const initial = React.useMemo(() => signature(fromDeck(deck)), [deck]);
  const [errors, setErrors] = React.useState<Record<number, Record<string, string>>>({});
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [csvOpen, setCsvOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const dirty = signature(rows) !== initial;
  useUnsavedChanges(dirty);

  const change = React.useCallback((key: string, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);
  const move = React.useCallback((key: string, delta: -1 | 1) => {
    setRows((list) => {
      const i = list.findIndex((r) => r.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);
  const remove = React.useCallback((key: string) => setRows((list) => list.filter((r) => r.key !== key)), []);
  const blank = (): Row => ({ key: nextKey(), id: null, front: "", back: "", article: "", plural: "", example: "", audio: null, image: null });
  const addRow = () => setRows((list) => (list.length >= MAX_CARDS ? list : [...list, blank()]));
  const addBulk = (drafts: DraftRow[]) => {
    setRows((list) => [
      ...list,
      ...drafts.slice(0, Math.max(0, MAX_CARDS - list.length)).map((d) => ({ ...blank(), front: d.front, back: d.back, article: d.article ?? ("" as const), plural: d.plural, example: d.example })),
    ]);
    toast.success(t("bulkAdded", { count: drafts.length }));
  };

  const submit = async () => {
    const incomplete = rows.findIndex((r) => !r.front.trim() || !r.back.trim());
    if (incomplete >= 0) {
      setErrors({ [incomplete]: { front: t("incompleteRow", { n: incomplete + 1 }) } });
      toast.error(t("incompleteRow", { n: incomplete + 1 }));
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(rows.map(toUpsert));
      toast.success(t("saved"));
    } catch (err) {
      const mapped: Record<number, Record<string, string>> = {};
      if (isApiError(err)) {
        for (const [name, message] of Object.entries(err.fieldErrors)) {
          const m = /^cards\[(\d+)]\.(\w+)/.exec(name);
          if (m) (mapped[Number(m[1])] ??= {})[m[2]] = message;
        }
      }
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      else toast.error(errorMessage(err));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await flashcardsApi.exportCsv(itemId);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground tabular-nums">{t("cardCount", { count: rows.length, max: MAX_CARDS })}</p>
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={rows.length >= MAX_CARDS}>
          <Plus /> {t("addCard")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)} disabled={rows.length >= MAX_CARDS}>
          <ListPlus /> {t("bulkAdd")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setCsvOpen(true)} disabled={dirty} title={dirty ? t("saveBeforeImport") : undefined}>
          <FileUp /> {t("importCsv")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void exportCsv()} loading={exporting} disabled={dirty || rows.length === 0}>
          <Download /> {t("exportCsv")}
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} loading={save.isPending} disabled={!dirty}>
          <Save /> {t("saveDeck")}
        </Button>
      </div>
      {dirty && <p className="text-xs text-muted-foreground">{t("unsaved")}</p>}

      {rows.length === 0 ? (
        <EmptyState
          title={t("editorEmptyTitle")}
          description={t("editorEmptyText")}
          action={
            <>
              <Button onClick={addRow}>
                <Plus /> {t("addCard")}
              </Button>
              <Button variant="outline" onClick={() => setCsvOpen(true)}>
                <FileUp /> {t("importCsv")}
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div className="hidden grid-cols-[2rem_minmax(0,1.3fr)_6rem_minmax(0,1.3fr)_minmax(0,1.2fr)_9.5rem] gap-3 px-3 text-xs font-medium text-muted-foreground md:grid" aria-hidden>
            <span>#</span>
            <span>{t("front")}</span>
            <span>{t("article")}</span>
            <span>{t("back")}</span>
            <span>{t("plural")}</span>
            <span />
          </div>
          <ol className="grid gap-2" aria-label={t("cardsLabel")}>
            {rows.map((r, i) => (
              <CardRow key={r.key} row={r} index={i} total={rows.length} error={errors[i]} onChange={change} onMove={move} onRemove={remove} />
            ))}
          </ol>
        </>
      )}

      <BulkAddDialog open={bulkOpen} onOpenChange={setBulkOpen} onAdd={addBulk} />
      <CsvImportDialog itemId={itemId} open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}

/** Instructor editor of a FLASHCARDS item: inline-editable card list, bulk add and CSV import/export. */
export function DeckEditor({ itemId }: { itemId: string }) {
  const deck = useDeck(itemId);
  if (deck.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }
  if (deck.isError) return <ErrorState error={deck.error} onRetry={() => deck.refetch()} />;
  return <Editor key={deck.dataUpdatedAt} itemId={itemId} deck={deck.data} />;
}

