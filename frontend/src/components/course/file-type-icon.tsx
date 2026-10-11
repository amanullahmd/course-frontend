import {
  File,
  FileArchive,
  FileHeadphone,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import type { MediaKind } from "@/lib/api/types";
import { cn, fileExtension } from "@/lib/utils";

interface FileStyle {
  icon: LucideIcon;
  className: string;
  label: string;
}

export function fileStyle(name: string, contentType?: string | null, kind?: MediaKind): FileStyle {
  const ext = fileExtension(name);
  const type = contentType ?? "";
  if (ext === "pdf" || type === "application/pdf") return { icon: FileText, className: "bg-red-500/10 text-red-600 dark:text-red-300", label: "PDF" };
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { icon: FileText, className: "bg-blue-500/10 text-blue-600 dark:text-blue-300", label: "Word" };
  if (["ppt", "pptx", "odp", "key"].includes(ext)) return { icon: Presentation, className: "bg-orange-500/10 text-orange-600 dark:text-orange-300", label: "Slides" };
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return { icon: FileSpreadsheet, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", label: "Spreadsheet" };
  if (kind === "IMAGE" || type.startsWith("image/")) return { icon: FileImage, className: "bg-teal-500/10 text-teal-600 dark:text-teal-300", label: "Image" };
  if (kind === "AUDIO" || type.startsWith("audio/")) return { icon: FileHeadphone, className: "bg-violet-500/10 text-violet-600 dark:text-violet-300", label: "Audio" };
  if (kind === "VIDEO" || type.startsWith("video/")) return { icon: FileVideoCamera, className: "bg-rose-500/10 text-rose-600 dark:text-rose-300", label: "Video" };
  if (kind === "ARCHIVE" || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return { icon: FileArchive, className: "bg-amber-500/10 text-amber-700 dark:text-amber-300", label: "Archive" };
  if (["txt", "md", "json", "xml", "html", "srt", "vtt"].includes(ext) || type.startsWith("text/")) return { icon: FileCode, className: "bg-slate-500/10 text-slate-600 dark:text-slate-300", label: "Text" };
  return { icon: File, className: "bg-muted text-muted-foreground", label: ext ? ext.toUpperCase() : "File" };
}

export function FileTypeIcon({
  name,
  contentType,
  kind,
  className,
}: {
  name: string;
  contentType?: string | null;
  kind?: MediaKind;
  className?: string;
}) {
  const style = fileStyle(name, contentType, kind);
  const Icon = style.icon;
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", style.className, className)} title={style.label}>
      <Icon className="size-[45%]" aria-hidden />
    </span>
  );
}
