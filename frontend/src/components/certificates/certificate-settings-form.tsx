"use client";

import * as React from "react";
import { Award, ImageUp, Loader2, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { uploadMedia } from "@/lib/api/client";
import type {
  CertificateLanguage,
  CertificateSettingsDto,
  CertificateSettingsUpdate,
} from "@/lib/api/certificates";
import type { CefrLevel, MediaDto } from "@/lib/api/types";
import { CEFR_LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useUpdateCertificateSettings } from "@/hooks/queries/certificates";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CertificatePreview } from "./certificate-preview";
import { CERTIFICATE_TEXTS, type CertificateLang } from "./certificate-texts";

const PRESET_TITLES = ["Zertifikat", "Certificate"] as const;
type TitleMode = "default" | (typeof PRESET_TITLES)[number] | "custom";

interface FormState extends Omit<CertificateSettingsUpdate, "signatureImageId"> {
  signatureImage: MediaDto | null;
}

function fromDto(d: CertificateSettingsDto): FormState {
  return {
    enabled: d.enabled,
    minProgressPercent: d.minProgressPercent,
    requireAssessmentsPassed: d.requireAssessmentsPassed,
    minAverageScore: d.minAverageScore,
    showScore: d.showScore,
    title: d.title,
    level: d.level,
    signerName: d.signerName,
    signerTitle: d.signerTitle,
    signatureImage: d.signatureImage,
    organization: d.organization,
    customText: d.customText,
    language: d.language,
  };
}

function toUpdate(f: FormState): CertificateSettingsUpdate {
  const text = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    enabled: f.enabled,
    minProgressPercent: f.minProgressPercent,
    requireAssessmentsPassed: f.requireAssessmentsPassed,
    minAverageScore: f.minAverageScore,
    showScore: f.showScore,
    title: text(f.title),
    level: f.level,
    signerName: text(f.signerName),
    signerTitle: text(f.signerTitle),
    signatureImageId: f.signatureImage?.id ?? null,
    organization: text(f.organization),
    customText: text(f.customText),
    language: f.language,
  };
}

function clampPercent(v: string): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

function SignatureUpload({ value, onChange }: { value: MediaDto | null; onChange: (m: MediaDto | null) => void }) {
  const t = useTranslations("certificates.settings");
  const errorMessage = useErrorMessage();
  const input = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/gif"].includes(file.type)) {
      toast.error(t("signatureType"));
      return;
    }
    setProgress(0);
    try {
      onChange(await uploadMedia(file, { onProgress: setProgress }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-16 w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed bg-[#FFFCF5]">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed media URL
          <img src={value.url} alt={t("signatureAlt")} className="max-h-14 max-w-36 object-contain" />
        ) : (
          <span className="px-2 text-center text-[11px] text-zinc-500">{t("signatureNone")}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          className="sr-only"
          id="signature-file"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={progress != null}>
          {progress != null ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {progress != null ? `${progress}%` : value ? t("signatureReplace") : t("signatureUpload")}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 /> {t("signatureRemove")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Instructor settings of a course's certificate with a live preview that matches the PDF. */
export function CertificateSettingsForm({ settings }: { settings: CertificateSettingsDto }) {
  const t = useTranslations("certificates.settings");
  const tl = useTranslations("levels");
  const errorMessage = useErrorMessage();
  const save = useUpdateCertificateSettings(settings.courseId);
  const [initial, setInitial] = React.useState(() => fromDto(settings));
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [previewLang, setPreviewLang] = React.useState<CertificateLang>("de");
  const [today] = React.useState(() => new Date());
  const [origin] = React.useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const dirty = JSON.stringify(toUpdate(form)) !== JSON.stringify(toUpdate(initial));
  useUnsavedChanges(dirty);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const titleMode: TitleMode =
    form.title == null ? "default" : (PRESET_TITLES as readonly string[]).includes(form.title) ? (form.title as TitleMode) : "custom";
  const lang: CertificateLang = form.language === "EN" ? "en" : form.language === "DE" ? "de" : previewLang;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const saved = await save.mutateAsync(toUpdate(form));
      const next = fromDto(saved);
      setInitial(next);
      setForm(next);
      toast.success(saved.enabled ? t("savedEnabled") : t("saved"));
    } catch (error) {
      const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
      setErrors(fieldErrors);
      toast.error(errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} className="grid items-start gap-6 xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
      <div className="grid gap-4">
        <Card className={cn(form.enabled && "border-success/40 ring-1 ring-success/15")}>
          <CardContent className="pt-5 sm:pt-6">
            <SwitchRow
              id="cert-enabled"
              label={t("enabled")}
              hint={t("enabledHint")}
              checked={form.enabled}
              onChange={(v) => set("enabled", v)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={form.enabled ? "success" : "secondary"}>
                <Award /> {form.enabled ? t("statusOn") : t("statusOff")}
              </Badge>
              <span>{t("issuedCount", { count: settings.issuedCount })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("criteriaTitle")}</CardTitle>
            <CardDescription>{t("criteriaText")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field label={t("minProgress")} htmlFor="cert-progress" error={errors.minProgressPercent} hint={t("minProgressHint")}>
              <div className="flex items-center gap-3">
                <Slider
                  value={[form.minProgressPercent]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => set("minProgressPercent", v)}
                  aria-label={t("minProgress")}
                  className="flex-1"
                />
                <div className="relative w-20">
                  <Input
                    id="cert-progress"
                    type="number"
                    min={0}
                    max={100}
                    value={form.minProgressPercent}
                    onChange={(e) => set("minProgressPercent", clampPercent(e.target.value))}
                    className="pr-6 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </Field>
            <SwitchRow
              id="cert-assessments"
              label={t("assessmentsPassed")}
              hint={t("assessmentsPassedHint")}
              checked={form.requireAssessmentsPassed}
              onChange={(v) => set("requireAssessmentsPassed", v)}
            />
            <div className="grid gap-3">
              <SwitchRow
                id="cert-min-score"
                label={t("minScore")}
                hint={t("minScoreHint")}
                checked={form.minAverageScore != null}
                onChange={(v) => set("minAverageScore", v ? 70 : null)}
              />
              {form.minAverageScore != null && (
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.minAverageScore}
                    onChange={(e) => set("minAverageScore", clampPercent(e.target.value))}
                    aria-label={t("minScore")}
                    aria-invalid={errors.minAverageScore ? true : undefined}
                    className="pr-6 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("designTitle")}</CardTitle>
            <CardDescription>{t("designText")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field label={t("title")} htmlFor="cert-title-mode" error={errors.title}>
              <Select
                value={titleMode}
                onValueChange={(v) => set("title", v === "default" ? null : v === "custom" ? form.title ?? "" : v)}
              >
                <SelectTrigger id="cert-title-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {t("titleDefault", { en: CERTIFICATE_TEXTS.en.defaultTitle, de: CERTIFICATE_TEXTS.de.defaultTitle })}
                  </SelectItem>
                  {PRESET_TITLES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">{t("titleCustom")}</SelectItem>
                </SelectContent>
              </Select>
              {titleMode === "custom" && (
                <Input
                  value={form.title ?? ""}
                  maxLength={80}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={t("titlePlaceholder")}
                  aria-label={t("titleCustom")}
                  autoFocus
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("level")} htmlFor="cert-level">
                <Select value={form.level ?? "course"} onValueChange={(v) => set("level", v === "course" ? null : (v as CefrLevel))}>
                  <SelectTrigger id="cert-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">{t("levelCourse", { level: settings.courseLevel })}</SelectItem>
                    {CEFR_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l} · {tl(`${l}.name`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid content-start gap-2">
                <span className="text-sm font-medium">{t("showScore")}</span>
                <Switch checked={form.showScore} onCheckedChange={(v) => set("showScore", v)} aria-label={t("showScore")} />
              </div>
            </div>
            <Field label={t("language")} hint={t("languageHint")}>
              <Segmented<CertificateLanguage>
                aria-label={t("language")}
                value={form.language}
                onChange={(v) => set("language", v)}
                className="w-fit max-w-full"
                options={[
                  { value: "LEARNER", label: t("languageLearner") },
                  { value: "EN", label: "English" },
                  { value: "DE", label: "Deutsch" },
                ]}
              />
            </Field>
            <Field
              label={t("customText")}
              htmlFor="cert-text"
              error={errors.customText}
              labelAside={<span className="text-xs text-muted-foreground tabular-nums">{(form.customText ?? "").length}/400</span>}
            >
              <Textarea
                id="cert-text"
                rows={3}
                maxLength={400}
                value={form.customText ?? ""}
                onChange={(e) => set("customText", e.target.value)}
                placeholder={t("customTextPlaceholder")}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("signatureTitle")}</CardTitle>
            <CardDescription>{t("signatureText")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("signerName")} htmlFor="cert-signer" error={errors.signerName}>
                <Input
                  id="cert-signer"
                  maxLength={120}
                  value={form.signerName ?? ""}
                  onChange={(e) => set("signerName", e.target.value)}
                  placeholder={settings.defaultSignerName}
                />
              </Field>
              <Field label={t("signerTitle")} htmlFor="cert-signer-title" error={errors.signerTitle}>
                <Input
                  id="cert-signer-title"
                  maxLength={80}
                  value={form.signerTitle ?? ""}
                  onChange={(e) => set("signerTitle", e.target.value)}
                  placeholder={CERTIFICATE_TEXTS[lang].signerRole}
                />
              </Field>
            </div>
            <Field label={t("organization")} htmlFor="cert-org" error={errors.organization}>
              <Input
                id="cert-org"
                maxLength={120}
                value={form.organization ?? ""}
                onChange={(e) => set("organization", e.target.value)}
                placeholder="Sprachweg"
              />
            </Field>
            <Field label={t("signatureImage")} hint={t("signatureHint")} error={errors.signatureImageId}>
              <SignatureUpload value={form.signatureImage} onChange={(m) => set("signatureImage", m)} />
            </Field>
          </CardContent>
        </Card>

        <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-xl border bg-card/95 p-3 shadow-md backdrop-blur">
          <span className="flex-1 text-xs text-muted-foreground">{dirty ? t("unsaved") : t("allSaved")}</span>
          <Button type="button" variant="ghost" size="sm" disabled={!dirty || save.isPending} onClick={() => setForm(initial)}>
            <Undo2 /> {t("discard")}
          </Button>
          <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {t("save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:sticky xl:top-20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{t("previewTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("previewText")}</p>
          </div>
          {form.language === "LEARNER" && (
            <Segmented<CertificateLang>
              aria-label={t("previewLanguage")}
              value={previewLang}
              onChange={setPreviewLang}
              options={[
                { value: "en", label: "EN" },
                { value: "de", label: "DE" },
              ]}
            />
          )}
        </div>
        <div className="rounded-2xl border bg-[repeating-linear-gradient(45deg,var(--muted)_0_10px,transparent_10px_20px)] p-3 sm:p-5">
          <CertificatePreview
            model={{
              title: form.title?.trim() || null,
              learnerName: t("sampleLearner"),
              courseTitle: settings.courseTitle,
              level: form.level ?? settings.courseLevel,
              completedAt: today,
              finalScore: 92.5,
              showScore: form.showScore,
              signerName: form.signerName?.trim() || settings.defaultSignerName,
              signerTitle: form.signerTitle,
              organization: form.organization,
              customText: form.customText,
              signatureUrl: form.signatureImage?.url ?? null,
              code: "SW-2026-7KQ4-M9XP-R2TA",
              verificationUrl: `${origin}/certificates/verify/SW-2026-7KQ4-M9XP-R2TA`,
              lang,
            }}
          />
        </div>
        {!form.enabled && <p className="text-xs text-muted-foreground">{t("previewDisabledHint")}</p>}
      </div>
    </form>
  );
}
