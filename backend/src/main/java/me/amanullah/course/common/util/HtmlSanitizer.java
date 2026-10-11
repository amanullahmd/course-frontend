package me.amanullah.course.common.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

/**
 * Sanitizes rich text (HTML) bodies with a relaxed safelist: formatting, lists, tables, links, images,
 * headings, code — but no scripts, styles, event handlers or iframes.
 */
public final class HtmlSanitizer {

    private static final Safelist SAFELIST = Safelist.relaxed()
            .addTags("hr", "s", "mark", "figure", "figcaption")
            .addAttributes("a", "target", "rel")
            .addAttributes("td", "colspan", "rowspan")
            .addAttributes("th", "colspan", "rowspan", "scope")
            .addEnforcedAttribute("a", "rel", "noopener noreferrer nofollow")
            .addProtocols("a", "href", "http", "https", "mailto")
            .addProtocols("img", "src", "http", "https");

    private static final Document.OutputSettings OUTPUT = new Document.OutputSettings().prettyPrint(false);

    private HtmlSanitizer() {
    }

    public static String sanitize(String html) {
        if (html == null || html.isBlank()) {
            return html == null ? null : "";
        }
        return Jsoup.clean(html, "", SAFELIST, OUTPUT);
    }

    public static String toPlainText(String html) {
        return html == null ? "" : Jsoup.parse(html).text();
    }
}
