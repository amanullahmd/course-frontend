import * as React from "react";
import Link from "next/link";

/**
 * Minimal, safe Markdown renderer for the operator-provided legal texts (content/legal/*.md): headings (#, ##, ###),
 * paragraphs (a line ending in a backslash or two spaces is a hard line break), unordered/ordered lists, blockquotes,
 * horizontal rules, **bold**, *italic*, `code`, [links](url) and {{PLACEHOLDER: …}} markers (highlighted).
 * Produces React elements only, never raw HTML.
 */

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join("").replace(/\\$/, "") });
    if (list) blocks.push(list);
    if (quote.length) blocks.push({ kind: "quote", text: quote.join(" ") });
    paragraph = [];
    list = null;
    quote = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: "h", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
      blocks.push({ kind: "hr" });
    } else if (line.startsWith(">")) {
      if (paragraph.length || list) flush();
      quote.push(line.replace(/^>\s?/, ""));
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (paragraph.length || quote.length || (list && list.kind !== kind)) flush();
      list ??= { kind, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (list || quote.length) flush();
      if (paragraph.length) {
        const prev = paragraph[paragraph.length - 1];
        paragraph[paragraph.length - 1] = prev.endsWith("\\") ? `${prev.slice(0, -1).trimEnd()}${BREAK}` : `${prev} `;
      }
      const hardBreak = /( {2,}|\\)$/.test(raw);
      paragraph.push(hardBreak ? `${line.replace(/\\$/, "").trim()}\\` : line.trim());
    }
  }
  flush();
  return blocks;
}

/** Hard line break marker inside paragraph text. */
const BREAK = "\u2028";

const INLINE = /(\{\{[^}]+\}\}|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  if (text.includes(BREAK)) {
    return text.split(BREAK).flatMap((part, i) => [
      ...(i > 0 ? [<br key={`${keyPrefix}-br${i}`} />] : []),
      ...inline(part, `${keyPrefix}-l${i}`),
    ]);
  }
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("{{")) {
      out.push(
        <mark key={key} className="rounded bg-warning-soft px-1 py-0.5 font-medium text-warning ring-1 ring-warning/30">
          {token.slice(2, -2).trim()}
        </mark>,
      );
    } else if (token.startsWith("**")) {
      out.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!;
      const href = m[2];
      if (href.startsWith("/")) {
        out.push(
          <Link key={key} href={href}>
            {m[1]}
          </Link>,
        );
      } else if (/^(https?:|mailto:)/i.test(href)) {
        out.push(
          <a key={key} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
            {m[1]}
          </a>,
        );
      } else {
        out.push(m[1]);
      }
    } else {
      out.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    }
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function Markdown({ source }: { source: string }) {
  return (
    <>
      {parse(source).map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "h": {
            const Tag = (`h${b.level}` as "h1" | "h2" | "h3");
            return (
              <Tag key={key} id={b.level > 1 ? slugify(b.text) : undefined}>
                {inline(b.text, key)}
              </Tag>
            );
          }
          case "p":
            return <p key={key}>{inline(b.text, key)}</p>;
          case "quote":
            return <blockquote key={key}>{inline(b.text, key)}</blockquote>;
          case "hr":
            return <hr key={key} />;
          default: {
            const List = b.kind;
            return (
              <List key={key}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item, `${key}-${j}`)}</li>
                ))}
              </List>
            );
          }
        }
      })}
    </>
  );
}
