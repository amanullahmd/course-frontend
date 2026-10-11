"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ItemType } from "@/lib/api/types";
import { ITEM_TYPES, ITEM_TYPE_META } from "@/lib/constants";
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
  const router = useRouter();
  const create = useCreateItem(courseId);
  const [type, setType] = React.useState<ItemType | null>(null);
  const [title, setTitle] = React.useState("");
  const [openEditor, setOpenEditor] = React.useState(true);

  const choose = (t: ItemType) => {
    setType(t);
    setTitle(DEFAULT_TITLES[t]);
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
          toast.success(`${ITEM_TYPE_META[item.type].label} added`);
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
            <Plus /> Add content
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>Choose a content type</DropdownMenuLabel>
          {ITEM_TYPES.map((t) => (
            <DropdownMenuItem key={t} onSelect={() => choose(t)} className="items-start gap-3 py-2">
              <ItemTypeIcon type={t} className="size-8 [&_svg]:!text-current" />
              <span className="grid gap-0.5">
                <span className="font-medium">{ITEM_TYPE_META[t].label}</span>
                <span className="text-xs text-muted-foreground">{ITEM_TYPE_META[t].description}</span>
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
                    <DialogTitle>New {ITEM_TYPE_META[type].label.toLowerCase()}</DialogTitle>
                    <DialogDescription>{ITEM_TYPE_META[type].description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="new-item-title">Title</Label>
                <Input id="new-item-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={openEditor} onCheckedChange={(c) => setOpenEditor(c === true)} />
                Open the editor after creating
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setType(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
