"use client";

import * as React from "react";
import { FileUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { FlashcardImportResult } from "@/lib/api/types";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useImportCsv } from "@/hooks/queries/practice";
import { ArticleBadge } from "./article-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const PREVIEW_ROWS = 8;

/** CSV import in two steps: preview with an error report, then commit. */
export function CsvImportDialog({
  itemId,
  open,
  onOpenChange,
}: {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("flashcards");
  const errorMessage = useErrorMessage();
  const importer = useImportCsv(itemId);
  const [file, setFile] = React.useState<File | null>(null);
  const [pasted, setPasted] = React.useState("");
  const [preview, setPreview] = React.useState<FlashcardImportResult | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPasted("");
    setPreview(null);
  };
  const source = (): File | null => file ?? (pasted.trim() ? new File([pasted], "cards.csv", { type: "text/csv" }) : null);

  const run = (commit: boolean) => {
    const f = source();
    if (!f) return;
    importer.mutate(
      { file: f, commit },
      {
        onSuccess: (result) => {
          if (commit) {
            toast.success(t("imported", { count: result.imported }));
            reset();
            onOpenChange(false);
          } else {
            setPreview(result);
          }
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("csvTitle")}</DialogTitle>
          <DialogDescription>{t("csvText")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => input.current?.click()}>
              <FileUp /> {t("chooseFile")}
            </Button>
            <span className="min-w-0 truncate text-sm text-muted-foreground">{file ? file.name : t("noFile")}</span>
            <input
              ref={input}
              type="file"
              hidden
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                e.target.value = "";
              }}
            />
          </div>
          {!file && (
            <Textarea
              rows={5}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setPreview(null);
              }}
              placeholder={"front;back;article;plural;example\nTisch;table;der;Tische;Der Tisch ist groß."}
              aria-label={t("csvPaste")}
              className="font-mono text-[13px]"
              spellCheck={false}
            />
          )}
        </div>

        {preview && (
          <div className="grid gap-3" aria-live="polite">
            <p className="text-sm">
              {t("previewSummary", { valid: preview.cards.length, rows: preview.rows, errors: preview.errors.length })}
            </p>
            {preview.cards.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">{t("front")}</th>
                      <th className="px-3 py-1.5 font-medium">{t("article")}</th>
                      <th className="px-3 py-1.5 font-medium">{t("back")}</th>
                      <th className="px-3 py-1.5 font-medium">{t("plural")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.cards.slice(0, PREVIEW_ROWS).map((c, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{c.front}</td>
                        <td className="px-3 py-1.5">{c.article ? <ArticleBadge article={c.article} className="text-xs" /> : "–"}</td>
                        <td className="px-3 py-1.5">{c.back}</td>
                        <td className="px-3 py-1.5">{c.plural ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.cards.length > PREVIEW_ROWS && (
                  <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                    {t("andMore", { count: preview.cards.length - PREVIEW_ROWS })}
                  </p>
                )}
              </div>
            )}
            {preview.errors.length > 0 && (
              <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft/60 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-warning">
                  <TriangleAlert className="size-4" aria-hidden /> {t("skippedRows", { count: preview.errors.length })}
                </p>
                <ul className="mt-2 grid max-h-32 gap-1 overflow-y-auto text-[13px]">
                  {preview.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      {t("errorLine", { line: e.line })}: {t(`csvErrors.${e.code === "REQUIRED" || e.code === "TOO_LONG" || e.code === "ARTICLE_INVALID" ? e.code : "OTHER"}`, { field: t(`field.${e.field === "front" || e.field === "back" || e.field === "article" || e.field === "plural" || e.field === "example" ? e.field : "front"}`) })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          {!preview ? (
            <Button onClick={() => run(false)} loading={importer.isPending} disabled={!file && !pasted.trim()}>
              {t("preview")}
            </Button>
          ) : (
            <Button onClick={() => run(true)} loading={importer.isPending} disabled={preview.cards.length === 0}>
              {t("importButton", { count: preview.cards.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
