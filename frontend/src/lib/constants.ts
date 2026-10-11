import {
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Link2,
  ListChecks,
  SquarePlay,
  type LucideIcon,
} from "lucide-react";
import type {
  CefrLevel,
  EnrollmentMode,
  EnrollmentStatus,
  ItemType,
  QuestionType,
  Role,
  Visibility,
} from "@/lib/api/types";

export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CEFR_META: Record<CefrLevel, { name: string; german: string; description: string; className: string; dot: string }> = {
  A1: {
    name: "Beginner",
    german: "Anfänger",
    description: "Understand and use everyday expressions and very basic phrases.",
    className: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  A2: {
    name: "Elementary",
    german: "Grundlagen",
    description: "Communicate in simple, routine tasks on familiar topics.",
    className: "bg-teal-500/10 text-teal-700 ring-teal-600/20 dark:text-teal-300 dark:ring-teal-400/25",
    dot: "bg-teal-500",
  },
  B1: {
    name: "Intermediate",
    german: "Mittelstufe",
    description: "Handle most situations while travelling and talk about experiences.",
    className: "bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-400/25",
    dot: "bg-sky-500",
  },
  B2: {
    name: "Upper intermediate",
    german: "Gute Mittelstufe",
    description: "Interact fluently with native speakers on a wide range of subjects.",
    className: "bg-indigo-500/10 text-indigo-700 ring-indigo-600/20 dark:text-indigo-300 dark:ring-indigo-400/25",
    dot: "bg-indigo-500",
  },
  C1: {
    name: "Advanced",
    german: "Fortgeschritten",
    description: "Express ideas fluently for social, academic and professional purposes.",
    className: "bg-violet-500/10 text-violet-700 ring-violet-600/20 dark:text-violet-300 dark:ring-violet-400/25",
    dot: "bg-violet-500",
  },
  C2: {
    name: "Proficient",
    german: "Annähernd muttersprachlich",
    description: "Understand virtually everything and express yourself precisely.",
    className: "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-600/20 dark:text-fuchsia-300 dark:ring-fuchsia-400/25",
    dot: "bg-fuchsia-500",
  },
};

export const ITEM_TYPES: ItemType[] = ["TEXT", "DOCUMENT", "VIDEO", "AUDIO", "IMAGE", "EMBED", "QUIZ", "EXAM"];

export const ITEM_TYPE_META: Record<ItemType, { label: string; description: string; icon: LucideIcon; className: string }> = {
  TEXT: {
    label: "Text lesson",
    description: "Rich text with headings, lists and highlights",
    icon: BookOpen,
    className: "text-slate-600 bg-slate-500/10 dark:text-slate-300",
  },
  DOCUMENT: {
    label: "Document",
    description: "PDF, Word, PowerPoint, Excel or any file",
    icon: FileText,
    className: "text-sky-600 bg-sky-500/10 dark:text-sky-300",
  },
  VIDEO: {
    label: "Video",
    description: "Upload a video or link YouTube / Vimeo",
    icon: SquarePlay,
    className: "text-rose-600 bg-rose-500/10 dark:text-rose-300",
  },
  AUDIO: {
    label: "Audio",
    description: "Listening practice with speed control",
    icon: Headphones,
    className: "text-violet-600 bg-violet-500/10 dark:text-violet-300",
  },
  IMAGE: {
    label: "Image",
    description: "Images and galleries with lightbox",
    icon: ImageIcon,
    className: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300",
  },
  EMBED: {
    label: "Embed / link",
    description: "External page, tool or resource",
    icon: Link2,
    className: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-300",
  },
  QUIZ: {
    label: "Quiz",
    description: "Practice questions with instant feedback",
    icon: ListChecks,
    className: "text-amber-600 bg-amber-500/10 dark:text-amber-300",
  },
  EXAM: {
    label: "Exam",
    description: "Timed assessment with attempt limits",
    icon: GraduationCap,
    className: "text-orange-600 bg-orange-500/10 dark:text-orange-300",
  },
};

export const ASSESSMENT_TYPES: ItemType[] = ["QUIZ", "EXAM"];
export const isAssessmentType = (type: ItemType): boolean => type === "QUIZ" || type === "EXAM";

export const VISIBILITY_META: Record<Visibility, { label: string; description: string; className: string; dot: string }> = {
  DRAFT: {
    label: "Draft",
    description: "Only you can see this.",
    className: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground/60",
  },
  SCHEDULED: {
    label: "Scheduled",
    description: "Goes live automatically at the scheduled time.",
    className: "bg-info-soft text-info ring-info/25",
    dot: "bg-info",
  },
  LIVE: {
    label: "Live",
    description: "Visible to approved learners.",
    className: "bg-success-soft text-success ring-success/25",
    dot: "bg-success",
  },
  EXPIRED: {
    label: "Expired",
    description: "The unpublish date has passed.",
    className: "bg-warning-soft text-warning ring-warning/30",
    dot: "bg-warning",
  },
};

export const ENROLLMENT_STATUS_META: Record<EnrollmentStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-info-soft text-info ring-info/25" },
  APPROVED: { label: "Approved", className: "bg-success-soft text-success ring-success/25" },
  REJECTED: { label: "Rejected", className: "bg-destructive-soft text-destructive ring-destructive/25" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-muted text-muted-foreground ring-border" },
  REVOKED: { label: "Revoked", className: "bg-warning-soft text-warning ring-warning/30" },
};

export const ENROLLMENT_MODE_META: Record<EnrollmentMode, { label: string; description: string }> = {
  APPROVAL: { label: "Approval required", description: "Learners apply and you approve them from a waiting list." },
  OPEN: { label: "Open enrollment", description: "Learners are accepted instantly while seats are available." },
};

export const QUESTION_TYPES: QuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "FILL_BLANK",
  "ESSAY",
];

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; description: string; icon: LucideIcon }> = {
  SINGLE_CHOICE: { label: "Single choice", description: "One correct option", icon: ClipboardCheck },
  MULTIPLE_CHOICE: { label: "Multiple choice", description: "Several correct options", icon: ListChecks },
  TRUE_FALSE: { label: "True / false", description: "Richtig oder falsch", icon: ClipboardCheck },
  SHORT_ANSWER: { label: "Short answer", description: "Typed answer, auto-graded", icon: FileText },
  FILL_BLANK: { label: "Fill in the blank", description: "Lückentext, auto-graded", icon: FileText },
  ESSAY: { label: "Essay", description: "Free text, graded manually", icon: BookOpen },
};

export const ROLE_META: Record<Role, { label: string; className: string }> = {
  STUDENT: { label: "Student", className: "bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300" },
  INSTRUCTOR: { label: "Instructor", className: "bg-brand-soft text-brand-strong ring-brand/30" },
  ADMIN: { label: "Admin", className: "bg-primary/10 text-foreground ring-primary/20" },
};

export const DEMO_ACCOUNTS = [
  { label: "Student", email: "student@sprachweg.de" },
  { label: "Instructor", email: "lehrer@sprachweg.de" },
  { label: "Admin", email: "admin@sprachweg.de" },
] as const;
export const DEMO_PASSWORD = "Password123!";
