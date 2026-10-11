"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { ItemType } from "@/lib/api/types";
import { ITEM_TYPES } from "@/lib/constants";
import { useCreateItem } from "@/hooks/queries/instructor";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_TITLES: Record<ItemType, string> = {
  TEXT: "Neue Lektion",
  DOCUMENT: "Arbeitsblatt",
  VIDEO: "Video",
  AUDIO: "Hörverstehen",
  IMAGE: "Bildergalerie",
  EMBED: "Externe Übung",
  QUIZ: "Quiz",
  EXAM: "Prüfung",
};

/** "Add content" menu listing all eight item types, followed by a quick title dialog. */
export function AddContentMenu({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const create = useCreateItem(courseId);
  const [type, setType] = React.useState<ItemType | null>(null);
  const [title, setTitle] = React.useState("");
  const [openEditor, setOpenEditor] = React.useState(true);

  const choose = (next: ItemType) => {
    setType(next);
    setTitle(DEFAULT_TITLES[next]);
  };

  const submit = () => {
    if (!type || !title.trim()) return;
    create.mutate(
      {
        moduleId,
        body: {
          type,
          title: title.trim(),
          summary: null,
          body: null,
          externalUrl: null,
          durationMinutes: null,
          attachmentIds: [],
        },
      },
      {
        onSuccess: (item) => {
          setType(null);
          toast.success(t("builder.itemAdded", { type: t(`itemTypes.${item.type}.label`) }));
          if (openEditor) router.push(`/instructor/courses/${courseId}/items/${item.id}`);
        },
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Plus /> {t("builder.addContent")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>{t("builder.chooseType")}</DropdownMenuLabel>
          {ITEM_TYPES.map((type) => (
            <DropdownMenuItem key={type} onSelect={() => choose(type)} className="items-start gap-3 py-2">
              <ItemTypeIcon type={type} className="size-8 [&_svg]:!text-current" />
              <span className="grid gap-0.5">
                <span className="font-medium">{t(`itemTypes.${type}.label`)}</span>
                <span className="text-xs text-muted-foreground">{t(`itemTypes.${type}.description`)}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={type !== null} onOpenChange={(o) => !o && setType(null)}>
        <DialogContent className="max-w-md">
          {type && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <ItemTypeIcon type={type} className="size-10" />
                  <div>
                    <DialogTitle>{t("builder.newItem", { type: t(`itemTypes.${type}.label`) })}</DialogTitle>
                    <DialogDescription>{t(`itemTypes.${type}.description`)}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="new-item-title">{t("builder.title")}</Label>
                <Input id="new-item-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={openEditor} onCheckedChange={(c) => setOpenEditor(c === true)} />
                {t("builder.openEditor")}
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setType(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
                  {t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
