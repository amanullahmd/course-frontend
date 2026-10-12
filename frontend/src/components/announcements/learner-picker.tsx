"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { EnrollmentDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";

/** Searchable multi-select of the course's approved learners. */
export function LearnerPicker({
  learners,
  loading,
  selected,
  onChange,
  invalid,
  describedBy,
}: {
  learners: EnrollmentDto[];
  loading?: boolean;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("announcements.composer");
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const visible = learners.filter(
    (e) => !needle || e.student.fullName.toLowerCase().includes(needle) || e.student.email.toLowerCase().includes(needle),
  );
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };

  return (
    <div className={cn("grid gap-2 rounded-xl border bg-card p-3", invalid && "border-destructive")} aria-describedby={describedBy}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder={t("searchLearners")} aria-label={t("searchLearners")} className="min-w-0 flex-1" />
      </div>
      <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span aria-live="polite">{t("selectedCount", { count: selected.size })}</span>
        <span className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={visible.length === 0}
            onClick={() => onChange(new Set([...selected, ...visible.map((e) => e.student.id)]))}
          >
            {t("selectAll")}
          </Button>
          <Button type="button" variant="ghost" size="xs" disabled={selected.size === 0} onClick={() => onChange(new Set())}>
            {t("clearAll")}
          </Button>
        </span>
      </div>
      <div className="max-h-60 overflow-y-auto rounded-lg border bg-background">
        {loading ? (
          <div className="grid gap-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : learners.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{t("noLearners")}</p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{t("noMatches")}</p>
        ) : (
          <ul className="divide-y">
            {visible.map((e) => {
              const checked = selected.has(e.student.id);
              const id = `learner-${e.student.id}`;
              return (
                <li key={e.student.id}>
                  <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent", checked && "bg-brand-soft/40")}>
                    <Checkbox id={id} checked={checked} onCheckedChange={(c) => toggle(e.student.id, c === true)} />
                    <UserAvatar name={e.student.fullName} src={e.student.avatarUrl} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.student.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{e.student.email}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
