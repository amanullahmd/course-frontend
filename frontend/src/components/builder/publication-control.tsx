"use client";

import * as React from "react";
import { CalendarClock, ChevronDown, EyeOff, Rocket } from "lucide-react";
import type { PublicationRequest, Publishable } from "@/lib/api/types";
import { VISIBILITY_META } from "@/lib/constants";
import { formatDateTime, timeZoneName } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { VisibilityBadge } from "@/components/course/badges";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";

type Mode = "DRAFT" | "NOW" | "SCHEDULE";

function initialMode(entity: Publishable): Mode {
  if (entity.publishStatus === "DRAFT") return "DRAFT";
  return entity.publishAt && entity.visibility === "SCHEDULED" ? "SCHEDULE" : "NOW";
}

/** Draft / publish now / schedule form with optional automatic unpublication. */
export function PublicationForm({
  entity,
  entityLabel,
  onSubmit,
  pending,
  onDone,
}: {
  entity: Publishable;
  entityLabel: string;
  onSubmit: (body: PublicationRequest) => Promise<unknown>;
  pending?: boolean;
  onDone?: () => void;
}) {
  const [mode, setMode] = React.useState<Mode>(() => initialMode(entity));
  const [publishAt, setPublishAt] = React.useState<string | null>(entity.publishAt);
  const [unpublishAt, setUnpublishAt] = React.useState<string | null>(entity.unpublishAt);
  const [withEnd, setWithEnd] = React.useState<boolean>(!!entity.unpublishAt);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (mode === "SCHEDULE" && !publishAt) return setError("Choose when this should go live.");
    if (mode !== "DRAFT" && withEnd && !unpublishAt) return setError("Choose when this should be unpublished, or turn the end date off.");
    if (mode === "SCHEDULE" && withEnd && publishAt && unpublishAt && unpublishAt <= publishAt) {
      return setError("The unpublish date must be after the publish date.");
    }
    const body: PublicationRequest =
      mode === "DRAFT"
        ? { publishStatus: "DRAFT", publishAt: null, unpublishAt: null }
        : {
            publishStatus: "PUBLISHED",
            publishAt: mode === "SCHEDULE" ? publishAt : null,
            unpublishAt: withEnd ? unpublishAt : null,
          };
    try {
      await onSubmit(body);
      onDone?.();
    } catch {
      /* toast handled globally */
    }
  };

  const options: { value: Mode; label: string; icon: React.ReactNode; hint: string }[] = [
    { value: "DRAFT", label: "Draft", icon: <EyeOff />, hint: "Hidden from learners" },
    { value: "NOW", label: "Publish now", icon: <Rocket />, hint: "Visible immediately" },
    { value: "SCHEDULE", label: "Schedule", icon: <CalendarClock />, hint: "Goes live at a set time" },
  ];

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label={`${entityLabel} visibility`} className="grid grid-cols-3 gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            onClick={() => setMode(o.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-colors hover:bg-accent [&_svg]:size-4",
              mode === o.value && "border-brand bg-brand-soft/50 text-foreground ring-1 ring-brand",
            )}
            title={o.hint}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      {mode === "SCHEDULE" && (
        <div className="grid gap-1.5">
          <Label htmlFor="publish-at">Publish at</Label>
          <DateTimePicker id="publish-at" value={publishAt} onChange={setPublishAt} clearable={false} />
        </div>
      )}

      {mode !== "DRAFT" && (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="with-end" className="text-[13px]">
              Unpublish automatically
            </Label>
            <Switch id="with-end" checked={withEnd} onCheckedChange={setWithEnd} />
          </div>
          {withEnd && <DateTimePicker id="unpublish-at" value={unpublishAt} onChange={setUnpublishAt} aria-label="Unpublish at" />}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">Times are in your time zone ({timeZoneName()}).</p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button onClick={submit} loading={pending}>
        {mode === "DRAFT" ? "Save as draft" : mode === "NOW" ? "Publish" : "Schedule"}
      </Button>
    </div>
  );
}

/** Badge + popover trigger used in builder rows and headers. */
export function PublicationPopover({
  entity,
  entityLabel,
  onSubmit,
  pending,
  trigger = "badge",
  align = "end",
}: {
  entity: Publishable;
  entityLabel: string;
  onSubmit: (body: PublicationRequest) => Promise<unknown>;
  pending?: boolean;
  trigger?: "badge" | "icon" | "button";
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger === "icon" ? (
        <Tooltip content="Publish / schedule">
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Schedule ${entityLabel}`}>
              <CalendarClock />
            </Button>
          </PopoverTrigger>
        </Tooltip>
      ) : trigger === "button" ? (
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <CalendarClock /> Publish settings <ChevronDown className="opacity-60" />
          </Button>
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${entityLabel} status: ${VISIBILITY_META[entity.visibility].label}. Change publication`}
        >
          <VisibilityBadge visibility={entity.visibility} publishAt={entity.publishAt} unpublishAt={entity.unpublishAt} compact className="cursor-pointer hover:brightness-95" />
        </PopoverTrigger>
      )}
      <PopoverContent align={align} className="w-80">
        <div className="mb-4 grid gap-1">
          <p className="text-sm font-semibold">Publish {entityLabel}</p>
          <p className="text-xs text-muted-foreground">
            Currently <span className="font-medium text-foreground">{VISIBILITY_META[entity.visibility].label}</span>
            {entity.publishAt && ` · live from ${formatDateTime(entity.publishAt)}`}
            {entity.unpublishAt && ` · until ${formatDateTime(entity.unpublishAt)}`}
          </p>
        </div>
        {open && <PublicationForm entity={entity} entityLabel={entityLabel} onSubmit={onSubmit} pending={pending} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

/** One-click publish/unpublish switch that keeps scheduled dates. */
export function PublishSwitch({
  entity,
  entityLabel,
  onSubmit,
  disabled,
}: {
  entity: Publishable;
  entityLabel: string;
  onSubmit: (body: PublicationRequest) => void;
  disabled?: boolean;
}) {
  const published = entity.publishStatus === "PUBLISHED";
  return (
    <Tooltip content={published ? "Published: click to move back to draft" : "Draft: click to publish"}>
      <span className="inline-flex">
        <Switch
          checked={published}
          disabled={disabled}
          aria-label={`${published ? "Unpublish" : "Publish"} ${entityLabel}`}
          onCheckedChange={(checked) =>
            onSubmit({
              publishStatus: checked ? "PUBLISHED" : "DRAFT",
              publishAt: entity.publishAt,
              unpublishAt: entity.unpublishAt,
            })
          }
        />
      </span>
    </Tooltip>
  );
}
