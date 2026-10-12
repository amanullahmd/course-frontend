# Legal texts (operator content)

These files are rendered at `/impressum`, `/datenschutz` and `/agb` (one file per page and language:
`<page>.de.md`, `<page>.en.md`). They are **templates**: replace every `{{PLACEHOLDER: …}}` marker, have the texts
reviewed by a lawyer, then set `LEGAL_PAGES_REVIEWED=true` in the frontend's runtime environment to hide the
"template" banner.

Supported Markdown: `#`/`##`/`###` headings, paragraphs, `-` and `1.` lists, `>` notes, `---`, `**bold**`,
`*italic*`, `` `code` ``, `[link](https://…)` / `[link](/path)` and `{{…}}` highlighted placeholders. No raw HTML.

The German version is the legally relevant one; the English version is a convenience translation.
The files are read at request time (shipped with the standalone build via `outputFileTracingIncludes`), so in Docker
they can also be replaced by mounting a volume at `/app/content/legal`.
