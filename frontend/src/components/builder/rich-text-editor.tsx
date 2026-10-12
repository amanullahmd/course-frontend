"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import {
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";

const EMPTY = "<p></p>";
const normalize = (html: string) => (html === EMPTY ? "" : html);

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
          active && "bg-accent text-foreground",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const t = useTranslations("editor");
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
      }}
    >
      <Tooltip content={t("link")}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("link")}
            aria-pressed={active}
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-4",
              active && "bg-accent text-foreground",
            )}
          >
            <LinkIcon />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-80 p-3" align="start">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const href = url.trim();
            if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: /^(https?:|mailto:)/.test(href) ? href : `https://${href}` })
                .run();
            setOpen(false);
          }}
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label={t("linkUrl")} autoFocus />
          <Button type="submit" size="sm">
            {t("apply")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("editor");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label={t("formatting")} className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b bg-card/95 p-1.5 backdrop-blur">
      <ToolButton label={t("heading")} active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label={t("subheading")} active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <Sep />
      <ToolButton label={t("bold")} active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label={t("italic")} active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label={t("underline")} active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </ToolButton>
      <ToolButton label={t("strike")} active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      <ToolButton label={t("highlight")} active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
        <Highlighter />
      </ToolButton>
      <LinkButton editor={editor} active={state.link} />
      {state.link && (
        <ToolButton label={t("removeLink")} onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
          <Unlink />
        </ToolButton>
      )}
      <Sep />
      <ToolButton label={t("bullet")} active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label={t("ordered")} active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label={t("quote")} active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label={t("divider")} onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
      <Sep />
      <ToolButton label={t("left")} active={state.left} onClick={() => chain().setTextAlign("left").run()}>
        <TextAlignStart />
      </ToolButton>
      <ToolButton label={t("center")} active={state.center} onClick={() => chain().setTextAlign("center").run()}>
        <TextAlignCenter />
      </ToolButton>
      <ToolButton label={t("right")} active={state.right} onClick={() => chain().setTextAlign("right").run()}>
        <TextAlignEnd />
      </ToolButton>
      <ToolButton label={t("clear")} onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting />
      </ToolButton>
      <span className="ml-auto flex">
        <ToolButton label={t("undo")} disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          <Undo2 />
        </ToolButton>
        <ToolButton label={t("redo")} disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          <Redo2 />
        </ToolButton>
      </span>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  id,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const t = useTranslations("editor");
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Placeholder.configure({ placeholder: placeholder ?? t("placeholder") }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose-sw tiptap px-4 py-4 sm:px-6 sm:py-5",
        ...(id ? { id } : {}),
        "aria-label": t("contentAria"),
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(normalize(e.getHTML())),
  });

  // Sync external resets (e.g. after saving or discarding).
  React.useEffect(() => {
    if (!editor) return;
    if (normalize(editor.getHTML()) !== (value || "")) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={cn("rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20", className)}>
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
        </>
      ) : (
        <div className="h-[300px] animate-pulse bg-muted/40" />
      )}
    </div>
  );
}
