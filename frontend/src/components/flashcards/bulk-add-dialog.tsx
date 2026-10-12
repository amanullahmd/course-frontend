"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { parseBulkLines, type DraftRow } from "@/lib/flashcards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Paste many cards at once: one per line, "front;back;article;plural;example" or tab separated. */
export function BulkAddDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (rows: DraftRow[]) => void;
}) {
  const t = useTranslations("flashcards");
  const [text, setText] = React.useState("");
  const rows = React.useMemo(() => parseBulkLines(text), [text]);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setText("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("bulkTitle")}</DialogTitle>
          <DialogDescription>{t("bulkText")}</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"der Tisch;table;Tische\ndie Lampe;lamp;Lampen\ngehen;to go"}
          aria-label={t("bulkTitle")}
          className="font-mono text-[13px]"
          spellCheck={false}
        />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("bulkRecognised", { count: rows.length })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={rows.length === 0}
            onClick={() => {
              onAdd(rows);
              setText("");
              onOpenChange(false);
            }}
          >
            {t("bulkAddButton", { count: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
