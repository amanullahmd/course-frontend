import { cn } from "@/lib/utils";

const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

/**
 * Renders server-sanitised HTML (lesson bodies, descriptions) with prose styles.
 * Plain text falls back to paragraphs.
 */
export function RichContent({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html || !html.trim()) return null;
  if (!looksLikeHtml(html)) {
    return (
      <div className={cn("prose-sw", className)}>
        {html.split(/\n{2,}/).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    );
  }
  return <div className={cn("prose-sw", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Short server-sanitised HTML (e.g. question prompts) rendered inline; plain text keeps line breaks. */
export function InlineHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null;
  if (!looksLikeHtml(html)) return <span className={cn("whitespace-pre-line", className)}>{html}</span>;
  return <span className={cn("[&_p]:inline [&_strong]:font-semibold", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
