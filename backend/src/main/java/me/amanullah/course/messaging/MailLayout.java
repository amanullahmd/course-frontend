package me.amanullah.course.messaging;

import org.springframework.web.util.HtmlUtils;

/**
 * The inline-styled HTML shell shared by announcement and message e-mails (same look as
 * {@code notification.EmailTemplates}). {@code contentHtml} must already be safe (escaped or sanitized).
 */
public final class MailLayout {

    private MailLayout() {
    }

    public static String render(String lang, String heading, String contentHtml, String ctaLabel, String link,
                                String linkHint, String footer) {
        String l = esc(link);
        return """
                <!doctype html>
                <html lang="%s"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
                <tr><td align="center">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
                <tr><td style="background:#1e3a8a;padding:20px 32px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px">Sprachweg</td></tr>
                <tr><td style="padding:32px">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">%s</h1>
                %s
                <p style="margin:24px 0"><a href="%s" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px">%s</a></p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a">%s<br><a href="%s" style="color:#1e3a8a;word-break:break-all">%s</a></p>
                </td></tr>
                <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa">%s</td></tr>
                </table></td></tr></table></body></html>
                """.formatted(esc(lang), esc(heading), contentHtml, l, esc(ctaLabel), esc(linkHint), l, l, esc(footer));
    }

    public static String paragraph(String text) {
        return "<p style=\"margin:0 0 12px;font-size:15px;line-height:1.6\">" + esc(text) + "</p>";
    }

    public static String esc(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s);
    }
}
