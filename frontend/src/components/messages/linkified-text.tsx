import * as React from "react";
import { cn } from "@/lib/utils";

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}])/gi;

/** Plain text with preserved line breaks; http(s) and www. URLs become links (no HTML is ever interpreted). */
export function LinkifiedText({ text, className, linkClassName }: { text: string; className?: string; linkClassName?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const url = match[0];
    const href = url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn("break-all underline underline-offset-2", linkClassName)}
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>{parts}</span>;
}
