import {
  ArrowDownUp,
  ArrowLeftRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Headphones,
  Layers,
  PenLine,
  Image as ImageIcon,
  Link2,
  LayoutList,
  ListChecks,
  Mic,
  SquarePlay,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import type {
  CefrLevel,
  EnrollmentStatus,
  ItemType,
  QuestionType,
  Role,
  Visibility,
} from "@/lib/api/types";

export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CEFR_META: Record<CefrLevel, { className: string; dot: string }> = {
  A1: {
    className: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  A2: {
    className: "bg-teal-500/10 text-teal-700 ring-teal-600/20 dark:text-teal-300 dark:ring-teal-400/25",
    dot: "bg-teal-500",
  },
  B1: {
    className: "bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/25",
    dot: "bg-sky-500",
  },
  B2: {
    className: "bg-indigo-500/10 text-indigo-700 ring-indigo-600/20 dark:text-indigo-300 dark:ring-indigo-400/25",
    dot: "bg-indigo-500",
  },
  C1: {
    className: "bg-violet-500/10 text-violet-700 ring-violet-600/20 dark:text-violet-300 dark:ring-violet-400/25",
    dot: "bg-violet-500",
  },
  C2: {
    className: "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-600/20 dark:text-fuchsia-300 dark:ring-fuchsia-400/25",
    dot: "bg-fuchsia-500",
  },
};

export const ITEM_TYPES: ItemType[] = ["TEXT", "DOCUMENT", "VIDEO", "AUDIO", "IMAGE", "EMBED", "QUIZ", "EXAM", "FLASHCARDS", "ASSIGNMENT"];

export const ITEM_TYPE_META: Record<ItemType, { icon: LucideIcon; className: string }> = {
  TEXT: {
    icon: BookOpen,
    className: "text-slate-600 bg-slate-500/10 dark:text-slate-300",
  },
  DOCUMENT: {
    icon: FileText,
    className: "text-sky-600 bg-sky-500/10 dark:text-sky-300",
  },
  VIDEO: {
    icon: SquarePlay,
    className: "text-rose-600 bg-rose-500/10 dark:text-rose-300",
  },
  AUDIO: {
    icon: Headphones,
    className: "text-violet-600 bg-violet-500/10 dark:text-violet-300",
  },
  IMAGE: {
    icon: ImageIcon,
    className: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300",
  },
  EMBED: {
    icon: Link2,
    className: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-300",
  },
  QUIZ: {
    icon: ListChecks,
    className: "text-amber-600 bg-amber-500/10 dark:text-amber-300",
  },
  EXAM: {
    icon: GraduationCap,
    className: "text-orange-600 bg-orange-500/10 dark:text-orange-300",
  },
  FLASHCARDS: {
    icon: Layers,
    className: "text-teal-600 bg-teal-500/10 dark:text-teal-300",
  },
  ASSIGNMENT: {
    icon: PenLine,
    className: "text-pink-600 bg-pink-500/10 dark:text-pink-300",
  },
};

export const ASSESSMENT_TYPES: ItemType[] = ["QUIZ", "EXAM"];
export const isAssessmentType = (type: ItemType): boolean => type === "QUIZ" || type === "EXAM";

export const VISIBILITY_META: Record<Visibility, { className: string; dot: string }> = {
  DRAFT: {
    className: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground/60",
  },
  SCHEDULED: {
    className: "bg-info-soft text-info ring-info/25",
    dot: "bg-info",
  },
  LIVE: {
    className: "bg-success-soft text-success ring-success/25",
    dot: "bg-success",
  },
  EXPIRED: {
    className: "bg-warning-soft text-warning ring-warning/30",
    dot: "bg-warning",
  },
};

export const ENROLLMENT_STATUS_META: Record<EnrollmentStatus, { className: string }> = {
  PENDING: { className: "bg-info-soft text-info ring-info/25" },
  APPROVED: { className: "bg-success-soft text-success ring-success/25" },
  REJECTED: { className: "bg-destructive-soft text-destructive ring-destructive/25" },
  WITHDRAWN: { className: "bg-muted text-muted-foreground ring-border" },
  REVOKED: { className: "bg-warning-soft text-warning ring-warning/30" },
};

export const QUESTION_TYPES: QuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "FILL_BLANK",
  "ESSAY",
  "CLOZE",
  "WORD_BANK",
  "MATCHING",
  "ORDERING",
  "DICTATION",
  "SPEAKING",
];

export const QUESTION_TYPE_META: Record<QuestionType, { icon: LucideIcon }> = {
  SINGLE_CHOICE: { icon: ClipboardCheck },
  MULTIPLE_CHOICE: { icon: ListChecks },
  TRUE_FALSE: { icon: ClipboardCheck },
  SHORT_ANSWER: { icon: FileText },
  FILL_BLANK: { icon: FileText },
  ESSAY: { icon: BookOpen },
  CLOZE: { icon: TextCursorInput },
  WORD_BANK: { icon: LayoutList },
  MATCHING: { icon: ArrowLeftRight },
  ORDERING: { icon: ArrowDownUp },
  DICTATION: { icon: Headphones },
  SPEAKING: { icon: Mic },
};

export const ROLE_META: Record<Role, { className: string }> = {
  STUDENT: { className: "bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300" },
  INSTRUCTOR: { className: "bg-brand-soft text-brand-strong ring-brand/30" },
  ADMIN: { className: "bg-primary/10 text-foreground ring-primary/20" },
};

export const DEMO_ACCOUNTS = [
  { role: "STUDENT", email: "student@sprachweg.de" },
  { role: "INSTRUCTOR", email: "lehrer@sprachweg.de" },
  { role: "ADMIN", email: "admin@sprachweg.de" },
] as const;
export const DEMO_PASSWORD = "Password123!";
