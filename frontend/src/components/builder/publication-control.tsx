"use client";

import * as React from "react";
import { CalendarClock, ChevronDown, EyeOff, Rocket } from "lucide-react";
import type { PublicationRequest, Publishable } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { timeZoneName } from "@/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { VisibilityBadge } from "@/components/course/badges";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";

type Mode = "DRAFT" | "NOW" | "SCHEDULE";
export type EntityKind = "course" | "module" | "lesson" | "item";

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
  entityLabel: EntityKind;
  onSubmit: (body: PublicationRequest) => Promise<unknown>;
  pending?: boolean;
  onDone?: () => void;
}) {
  const t = useTranslations("publication");
  const [mode, setMode] = React.useState<Mode>(() => initialMode(entity));
  const [publishAt, setPublishAt] = React.useState<string | null>(entity.publishAt);
  const [unpublishAt, setUnpublishAt] = React.useState<string | null>(entity.unpublishAt);
  const [withEnd, setWithEnd] = React.useState<boolean>(!!entity.unpublishAt);
  const [error, setError] = React.useState<string | null>(null);

  const unchanged =
    mode === initialMode(entity) &&
    (mode === "DRAFT" ||
      ((mode === "NOW" || publishAt === entity.publishAt) && (withEnd ? unpublishAt : null) === entity.unpublishAt));
  const alreadyPublished = entity.publishStatus === "PUBLISHED";

  const submit = async () => {
    setError(null);
    if (mode === "SCHEDULE" && !publishAt) return setError(t("errPublishAt"));
    if (mode !== "DRAFT" && withEnd && !unpublishAt) return setError(t("errUnpublishAt"));
    if (mode !== "DRAFT" && withEnd && unpublishAt && new Date(unpublishAt).getTime() <= Date.now()) {
      return setError(t("errUnpublishPast"));
    }
    if (mode === "SCHEDULE" && withEnd && publishAt && unpublishAt && unpublishAt <= publishAt) {
      return setError(t("errOrder"));
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
    { value: "DRAFT", label: t("draft"), icon: <EyeOff />, hint: t("draftHint") },
    { value: "NOW", label: t("now"), icon: <Rocket />, hint: t("nowHint") },
    { value: "SCHEDULE", label: t("schedule"), icon: <CalendarClock />, hint: t("scheduleHint") },
  ];

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label={t("visibilityGroup", { entity: t(`entity.${entityLabel}`) })} className="grid grid-cols-3 gap-1.5">
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
          <Label htmlFor="publish-at">{t("publishAt")}</Label>
          <DateTimePicker id="publish-at" value={publishAt} onChange={setPublishAt} clearable={false} />
        </div>
      )}

      {mode !== "DRAFT" && (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="with-end" className="text-[13px]">
              {t("autoUnpublish")}
            </Label>
            <Switch id="with-end" checked={withEnd} onCheckedChange={setWithEnd} />
          </div>
          {withEnd && <DateTimePicker id="unpublish-at" value={unpublishAt} onChange={setUnpublishAt} aria-label={t("unpublishAt")} />}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{t("timezone", { tz: timeZoneName() })}</p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button onClick={submit} loading={pending} disabled={unchanged && !pending}>
        {unchanged
          ? t("upToDate")
          : mode === "DRAFT"
            ? alreadyPublished
              ? t("unpublish")
              : t("saveDraft")
            : mode === "NOW"
              ? alreadyPublished
                ? t("update")
                : t("publish")
              : t("doSchedule")}
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
  entityLabel: EntityKind;
  onSubmit: (body: PublicationRequest) => Promise<unknown>;
  pending?: boolean;
  trigger?: "badge" | "icon" | "button" | "primary";
  align?: "start" | "center" | "end";
}) {
  const t = useTranslations();
  const fmt = useFormat();
  const [open, setOpen] = React.useState(false);
  const entityName = t(`publication.entity.${entityLabel}`);
  const status = t(`visibility.${entity.visibility}.label`);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger === "icon" ? (
        <Tooltip content={t("publication.popoverTrigger")}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t("publication.scheduleEntity", { entity: entityName })}>
              <CalendarClock />
            </Button>
          </PopoverTrigger>
        </Tooltip>
      ) : trigger === "primary" ? (
        <PopoverTrigger asChild>
          <Button size="sm">
            <Rocket /> {t("publication.publishEntity", { entity: entityName })}
          </Button>
        </PopoverTrigger>
      ) : trigger === "button" ? (
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <CalendarClock /> {t("publication.settings")} <ChevronDown className="opacity-60" />
          </Button>
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("publication.statusLabel", { entity: entityName, status })}
        >
          <VisibilityBadge visibility={entity.visibility} publishAt={entity.publishAt} unpublishAt={entity.unpublishAt} compact className="cursor-pointer hover:brightness-95" />
        </PopoverTrigger>
      )}
      <PopoverContent align={align} className="w-80">
        <div className="mb-4 grid gap-1">
          <p className="text-sm font-semibold">{t("publication.title", { entity: entityName })}</p>
          <p className="text-xs text-muted-foreground">
            {t.rich("publication.currently", { status, b: (c) => <span className="font-medium text-foreground">{c}</span> })}
            {entity.publishAt && t("publication.liveFrom", { date: fmt.dateTime(entity.publishAt) })}
            {entity.unpublishAt && t("publication.liveUntil", { date: fmt.dateTime(entity.unpublishAt) })}
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
  const t = useTranslations("publication");
  const published = entity.publishStatus === "PUBLISHED";
  return (
    <Tooltip content={published ? t("switchPublished") : t("switchDraft")}>
      <span className="inline-flex">
        <Switch
          checked={published}
          disabled={disabled}
          aria-label={published ? t("switchLabelOn", { name: entityLabel }) : t("switchLabelOff", { name: entityLabel })}
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
