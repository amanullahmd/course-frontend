"use client";

import * as React from "react";
import type { CefrLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import s from "./certificate-preview.module.css";
import {
  CERTIFICATE_TEXTS,
  certificateDensity,
  formatCertificateDate,
  formatCertificateScore,
  type CertificateLang,
} from "./certificate-texts";

export interface CertificatePreviewModel {
  title: string | null;
  learnerName: string;
  courseTitle: string;
  level: CefrLevel;
  completedAt: string | Date;
  finalScore: number | null;
  showScore: boolean;
  signerName: string;
  signerTitle: string | null;
  organization: string | null;
  customText: string | null;
  signatureUrl: string | null;
  code: string;
  verificationUrl: string;
  revoked?: boolean;
  lang: CertificateLang;
}

/** A4 landscape in CSS pixels (96 dpi). */
const PAGE_WIDTH = (297 / 25.4) * 96;
const PAGE_HEIGHT = (210 / 25.4) * 96;

/** The Sprachweg mark with fixed light colours (the certificate is always printed on paper). */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="#151C38" />
      <path d="M6.5 21.5c3.2 0 4.6-11 9.5-11s6.3 11 9.5 11" stroke="#F2B544" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="10.5" r="2.2" fill="#FFF7E6" />
    </svg>
  );
}

/** Stand-in for the QR code (the real one, pointing to the verification page, is drawn into the PDF). */
function QrPlaceholder({ seed, className }: { seed: string; className?: string }) {
  const n = 25;
  const cells: React.ReactNode[] = [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const finder = (x: number, y: number) => x < 8 && y < 8;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y)) continue;
      h = Math.imul(h ^ (x * 31 + y), 16777619);
      if ((h >>> 0) % 100 < 46) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  }
  const eye = (x: number, y: number) => (
    <g key={`eye-${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#FFFCF5" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={className} shapeRendering="crispEdges" aria-hidden>
      <rect width={n} height={n} fill="#FFFCF5" />
      <g fill="#151C38">
        {cells}
        {eye(0, 0)}
        {eye(n - 7, 0)}
        {eye(0, n - 7)}
      </g>
    </svg>
  );
}

function useScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PAGE_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/**
 * Pixel-faithful HTML replica of the certificate PDF (same millimetre layout, fonts and texts), scaled to the width
 * of its container.
 */
export function CertificatePreview({ model, className }: { model: CertificatePreviewModel; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const scale = useScale(ref);
  const t = CERTIFICATE_TEXTS[model.lang];
  const title = model.title?.trim() || t.defaultTitle;
  const density = certificateDensity(model);
  const org = model.organization?.trim() || "Sprachweg";
  const role = model.signerTitle?.trim() || t.signerRole;
  const showScore = model.showScore && model.finalScore != null;

  return (
    <div
      ref={ref}
      className={cn("relative w-full overflow-hidden rounded-md shadow-[0_1px_2px_rgba(0,0,0,.08),0_8px_28px_-8px_rgba(21,28,56,.28)]", className)}
      style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
      role="img"
      aria-label={`${title} – ${model.learnerName} – ${model.courseTitle}`}
    >
      <div
        aria-hidden
        className={cn(s.page, density && s[density])}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <div className={s["frame-outer"]} />
        <div className={s["frame-inner"]} />
        <div className={cn(s.corner, s["c-tl"])} />
        <div className={cn(s.corner, s["c-tr"])} />
        <div className={cn(s.corner, s["c-bl"])} />
        <div className={cn(s.corner, s["c-br"])} />
        <div className={s.content}>
          <div className={s["content-cell"]}>
            <div className={s.brand}>
              <Mark className={s.logo} />
              <span className={s["brand-name"]}>SPRACHWEG</span>
            </div>
            <div className={s.title}>{title}</div>
            <div className={s.divider}>
              <span className={s.rule} />
              <span className={s.diamond} />
              <span className={s.rule} />
            </div>
            <div className={s.lead}>{t.lead}</div>
            <div className={s.name}>{model.learnerName}</div>
            <div className={s["name-rule"]} />
            <div className={s.body}>{t.afterName}</div>
            <div className={s.course}>{model.courseTitle}</div>
            {t.afterCourse && <div className={cn(s.body, s.after)}>{t.afterCourse}</div>}
            <div className={s.meta}>
              {t.level(model.level)} <span className={s.dot}>·</span> {t.cefr}
              {showScore && (
                <>
                  {" "}
                  <span className={s.dot}>·</span> {t.score(formatCertificateScore(model.finalScore as number, model.lang))}
                </>
              )}
            </div>
            {model.customText?.trim() && <div className={s.custom}>{model.customText.trim()}</div>}
          </div>
        </div>
        <div className={cn(s.col, s["col-left"])}>
          <div className={s["col-value"]}>{formatCertificateDate(model.completedAt, model.lang)}</div>
          <div className={s["col-rule"]} />
          <div className={s["col-label"]}>{t.date}</div>
        </div>
        <div className={s.seal}>
          <div className={s["seal-inner"]}>
            <div className={s["seal-level"]}>{model.level}</div>
            <div className={s["seal-caption"]}>{t.sealCaption}</div>
          </div>
        </div>
        <div className={cn(s.col, s["col-right"])}>
          <div className={s.sig}>
            {model.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed media URL, rendered at print size
              <img className={s["sig-img"]} src={model.signatureUrl} alt="" />
            ) : (
              <div className={s["sig-script"]}>{model.signerName}</div>
            )}
          </div>
          <div className={s["col-rule"]} />
          <div className={s["col-name"]}>{model.signerName}</div>
          <div className={s["col-label"]}>
            {role} · {org}
          </div>
        </div>
        <QrPlaceholder seed={model.code} className={s.qr} />
        <div className={s.verify}>
          <span className={s["verify-label"]}>{t.verifyLabel}</span>
          <span className={s.dot}>·</span>
          <span className={s["verify-code"]}>{model.code}</span>
          <span className={s.dot}>·</span>
          <span className={s["verify-url"]}>{model.verificationUrl}</span>
        </div>
        {model.revoked && <div className={s.revoked}>{t.revoked}</div>}
      </div>
    </div>
  );
}
