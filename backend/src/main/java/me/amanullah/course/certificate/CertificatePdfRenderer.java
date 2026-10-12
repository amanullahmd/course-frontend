package me.amanullah.course.certificate;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import javax.imageio.ImageIO;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.course.CefrLevel;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.jsoup.helper.W3CDom;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/**
 * Renders a certificate as an A4 landscape PDF: an HTML/CSS template laid out in millimetres (mirrored by the
 * frontend's live preview) converted by openhtmltopdf (Apache PDFBox) with embedded, subsetted OFL fonts (Lora,
 * Work Sans, Nothing You Could Do; see {@code resources/certificate/fonts}), the Sprachweg logo mark and a QR code
 * (ZXing) pointing to the public verification page.
 */
@Component
public class CertificatePdfRenderer {

    /** Dates on certificates are calendar dates in the platform's home time zone. */
    static final ZoneId ZONE = ZoneId.of("Europe/Berlin");

    private static final String FONTS = "/certificate/fonts/";
    private static final Logger log = LoggerFactory.getLogger(CertificatePdfRenderer.class);

    /** Everything printed on one certificate; {@code title} {@code null} = localized default. */
    public record PdfModel(String code, String learnerName, String courseTitle, CefrLevel level, String title,
                           Instant completedAt, Double finalScore, boolean showScore, String signerName,
                           String signerTitle, String organization, String customText, byte[] signatureImage,
                           String signatureContentType, String verificationUrl, boolean revoked, Locale locale) {
    }

    private final Messages messages;
    private final String logoDataUri;

    public CertificatePdfRenderer(Messages messages) {
        this.messages = messages;
        this.logoDataUri = png(logoMark(256));
    }

    /** Renders one sample in the background after startup: the first rendering loads fonts and classes (seconds). */
    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        Thread.ofVirtual().name("certificate-pdf-warmup").start(() -> {
            try {
                render(new PdfModel("SW-2026-0000-0000-0000", "Sprachweg", "Sprachweg", CefrLevel.A1, null,
                        Instant.now(), 100.0, true, "Sprachweg", null, null, "Ä Ö Ü ß", null, null,
                        "https://example.org", true, Locale.GERMAN));
            } catch (RuntimeException e) {
                log.debug("Certificate renderer warm-up failed: {}", e.toString());
            }
        });
    }

    public byte[] render(PdfModel m) {
        String html = html(m);
        ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024);
        try {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            font(builder, "Lora-Regular.ttf", "Lora", 400, FontStyle.NORMAL);
            font(builder, "Lora-Italic.ttf", "Lora", 400, FontStyle.ITALIC);
            font(builder, "Lora-Bold.ttf", "Lora", 700, FontStyle.NORMAL);
            font(builder, "WorkSans-Regular.ttf", "Work Sans", 400, FontStyle.NORMAL);
            font(builder, "WorkSans-Bold.ttf", "Work Sans", 700, FontStyle.NORMAL);
            font(builder, "NothingYouCouldDo-Regular.ttf", "Signature", 400, FontStyle.NORMAL);
            builder.withW3cDocument(new W3CDom().fromJsoup(Jsoup.parse(html)), "/");
            builder.toStream(out);
            builder.run();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not render certificate PDF", e);
        }
        return out.toByteArray();
    }

    private static void font(PdfRendererBuilder builder, String file, String family, int weight, FontStyle style) {
        builder.useFont(() -> {
            InputStream in = CertificatePdfRenderer.class.getResourceAsStream(FONTS + file);
            if (in == null) {
                throw new IllegalStateException("Missing font " + file);
            }
            return in;
        }, family, weight, style, true);
    }

    String html(CertificatePdfRenderer.PdfModel m) {
        Locale l = m.locale();
        String title = blank(m.title()) ? msg(l, "cert.defaultTitle") : m.title().strip();
        String date = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(l)
                .format(m.completedAt().atZone(ZONE));
        StringBuilder meta = new StringBuilder(esc(msg(l, "cert.level", m.level().name())))
                .append(" <span class=\"dot\">·</span> ").append(esc(msg(l, "cert.cefr")));
        if (m.showScore() && m.finalScore() != null) {
            meta.append(" <span class=\"dot\">·</span> ").append(esc(msg(l, "cert.score", percent(m.finalScore(), l))));
        }
        String afterCourse = msg(l, "cert.afterCourse");
        String signature = m.signatureImage() != null
                ? "<img class=\"sig-img\" src=\"data:" + esc(m.signatureContentType()) + ";base64,"
                + Base64.getEncoder().encodeToString(m.signatureImage()) + "\" alt=\"\"/>"
                : "<div class=\"sig-script\">" + esc(m.signerName()) + "</div>";
        String signerRole = blank(m.signerTitle()) ? msg(l, "cert.signerRole") : m.signerTitle().strip();
        String org = blank(m.organization()) ? "Sprachweg" : m.organization().strip();
        String qr = png(qr(m.verificationUrl()));
        String density = density(m);

        return """
                <!DOCTYPE html>
                <html lang="%s"><head><meta charset="utf-8"/>
                <title>%s</title><meta name="author" content="%s"/><meta name="subject" content="%s"/>
                <style>%s</style></head>
                <body><div class="page %s">
                <div class="frame-outer"></div><div class="frame-inner"></div>
                <div class="corner c-tl"></div><div class="corner c-tr"></div>
                <div class="corner c-bl"></div><div class="corner c-br"></div>
                <div class="content"><div class="content-cell">
                  <div class="brand"><img class="logo" src="%s" alt=""/><span class="brand-name">SPRACHWEG</span></div>
                  <div class="title">%s</div>
                  <div class="divider"><span class="rule"></span><span class="diamond"></span><span class="rule"></span></div>
                  <div class="lead">%s</div>
                  <div class="name">%s</div>
                  <div class="name-rule"></div>
                  <div class="body">%s</div>
                  <div class="course">%s</div>
                  %s
                  <div class="meta">%s</div>
                  %s
                </div></div>
                <div class="col col-left">
                  <div class="col-value">%s</div>
                  <div class="col-rule"></div>
                  <div class="col-label">%s</div>
                </div>
                <div class="seal"><div class="seal-inner">
                  <div class="seal-level">%s</div><div class="seal-caption">%s</div>
                </div></div>
                <div class="col col-right">
                  <div class="sig">%s</div>
                  <div class="col-rule"></div>
                  <div class="col-name">%s</div>
                  <div class="col-label">%s</div>
                </div>
                <img class="qr" src="%s" alt=""/>
                <div class="verify"><span class="verify-label">%s</span><span class="dot">·</span><span class="verify-code">%s</span><span class="dot">·</span><span class="verify-url">%s</span></div>
                %s
                </div></body></html>
                """.formatted(
                l.getLanguage(), esc(title + " – " + m.learnerName()), esc(org), esc(m.courseTitle()), CSS,
                density, logoDataUri,
                esc(title),
                esc(msg(l, "cert.lead")),
                esc(m.learnerName()),
                esc(msg(l, "cert.afterName")),
                esc(m.courseTitle()),
                blank(afterCourse) ? "" : "<div class=\"body after\">" + esc(afterCourse) + "</div>",
                meta,
                blank(m.customText()) ? "" : "<div class=\"custom\">" + esc(m.customText().strip()) + "</div>",
                esc(date), esc(msg(l, "cert.date")),
                esc(m.level().name()), esc(msg(l, "cert.sealCaption")),
                signature, esc(m.signerName()), esc(signerRole + " · " + org),
                qr, esc(msg(l, "cert.verifyLabel")), esc(m.code()), esc(m.verificationUrl()),
                m.revoked() ? "<div class=\"revoked\">" + esc(msg(l, "cert.revokedStamp")) + "</div>" : "");
    }

    /** Layout in millimetres on a 297 × 210 mm page; keep in sync with the frontend preview. */
    private static final String CSS = """
            @page { size: 297mm 210mm; margin: 0; }
            html, body { margin: 0; padding: 0; }
            body { font-family: 'Work Sans', sans-serif; color: #151C38; }
            .page { position: relative; width: 297mm; height: 210mm; overflow: hidden; background: #FFFCF5; }
            .frame-outer { position: absolute; left: 8mm; top: 8mm; width: 278.2mm; height: 191.2mm; border: 1.4mm solid #151C38; }
            .frame-inner { position: absolute; left: 12mm; top: 12mm; width: 272.3mm; height: 185.3mm; border: 0.35mm solid #C59A45; }
            .corner { position: absolute; width: 4.2mm; height: 4.2mm; background: #C59A45; transform: rotate(45deg); }
            .c-tl { left: 10.05mm; top: 10.05mm; } .c-tr { right: 10.05mm; top: 10.05mm; }
            .c-bl { left: 10.05mm; bottom: 10.05mm; } .c-br { right: 10.05mm; bottom: 10.05mm; }
            .content { position: absolute; left: 30mm; width: 237mm; top: 17mm; height: 113mm; display: table; }
            .content-cell { display: table-cell; vertical-align: middle; text-align: center; }
            .brand { height: 10mm; }
            .logo { width: 9mm; height: 9mm; vertical-align: middle; }
            .brand-name { font-size: 8.5pt; font-weight: 700; letter-spacing: 1.1mm; color: #151C38; vertical-align: middle; padding-left: 2.5mm; }
            .title { font-family: 'Lora', serif; font-size: 31pt; line-height: 1.15; margin-top: 5mm; color: #151C38; }
            .divider { margin-top: 3mm; height: 3mm; }
            .rule { display: inline-block; width: 22mm; height: 0.3mm; background: #C59A45; vertical-align: middle; }
            .diamond { display: inline-block; width: 1.8mm; height: 1.8mm; background: #C59A45; transform: rotate(45deg); margin: 0 2.5mm; vertical-align: middle; }
            .lead { margin-top: 6mm; font-size: 8.5pt; letter-spacing: 0.6mm; text-transform: uppercase; color: #6B6F82; }
            .name { font-family: 'Lora', serif; font-style: italic; font-size: 34pt; line-height: 1.2; margin-top: 3mm; color: #151C38; }
            .name-rule { width: 120mm; height: 0.3mm; background: #C59A45; margin: 1.5mm auto 0 auto; }
            .body { margin-top: 5mm; font-size: 11pt; color: #3B4058; }
            .body.after { margin-top: 1.5mm; }
            .course { font-family: 'Lora', serif; font-weight: 700; font-size: 19pt; line-height: 1.25; margin-top: 2mm; color: #151C38; }
            .meta { margin-top: 3mm; font-size: 9pt; color: #6B6F82; }
            .dot { color: #C59A45; padding: 0 1mm; }
            .custom { margin: 4mm auto 0 auto; width: 175mm; font-family: 'Lora', serif; font-style: italic; font-size: 9.5pt; line-height: 1.45; color: #4A4F66; }
            .col { position: absolute; top: 140mm; width: 72mm; text-align: center; }
            .col-left { left: 34mm; }
            .col-right { right: 34mm; }
            .col-value { font-family: 'Lora', serif; font-size: 12.5pt; height: 14mm; line-height: 22mm; color: #151C38; }
            .sig { height: 14mm; }
            .sig-img { max-height: 14mm; max-width: 60mm; }
            .sig-script { font-family: 'Signature', cursive; font-size: 21pt; line-height: 16mm; color: #1E2A5A; }
            .col-rule { height: 0.25mm; background: #151C38; margin: 1.5mm 4mm 0 4mm; }
            .col-name { margin-top: 1.8mm; font-size: 9.5pt; font-weight: 700; color: #151C38; }
            .col-label { margin-top: 1.2mm; font-size: 7.5pt; letter-spacing: 0.3mm; text-transform: uppercase; color: #6B6F82; }
            .seal { position: absolute; left: 132.5mm; top: 135mm; width: 32mm; height: 32mm; border-radius: 16mm; background: #151C38; }
            .seal-inner { position: absolute; left: 1.6mm; top: 1.6mm; width: 27.4mm; height: 27.4mm; border-radius: 13.7mm; border: 0.4mm solid #C59A45; text-align: center; }
            .seal-level { font-family: 'Lora', serif; font-weight: 700; font-size: 21pt; color: #F2B544; margin-top: 6mm; line-height: 1; }
            .seal-caption { font-size: 5.5pt; letter-spacing: 0.35mm; text-transform: uppercase; color: #FFF7E6; margin-top: 1.6mm; }
            .qr { position: absolute; right: 19.5mm; bottom: 19.5mm; width: 17mm; height: 17mm; }
            .verify { position: absolute; left: 40mm; width: 217mm; bottom: 20mm; text-align: center; font-size: 7pt; color: #6B6F82; }
            .verify-label { letter-spacing: 0.3mm; text-transform: uppercase; }
            .verify-code { font-weight: 700; color: #151C38; }
            .compact .title { font-size: 26pt; margin-top: 3mm; }
            .compact .lead { margin-top: 4mm; }
            .compact .name { font-size: 28pt; margin-top: 2mm; }
            .compact .body { margin-top: 3.5mm; font-size: 10pt; }
            .compact .course { font-size: 16pt; }
            .compact .custom { font-size: 8.5pt; margin-top: 3mm; width: 190mm; }
            .dense .brand { height: 8mm; } .dense .logo { width: 7mm; height: 7mm; }
            .dense .title { font-size: 22pt; margin-top: 2mm; }
            .dense .divider { margin-top: 1.5mm; }
            .dense .lead { margin-top: 3mm; }
            .dense .name { font-size: 24pt; margin-top: 1.5mm; }
            .dense .body { margin-top: 2.5mm; font-size: 9.5pt; }
            .dense .course { font-size: 14pt; margin-top: 1mm; }
            .dense .meta { margin-top: 2mm; font-size: 8pt; }
            .dense .custom { font-size: 8pt; line-height: 1.35; margin-top: 2.5mm; width: 200mm; }
            .revoked { position: absolute; left: 68mm; top: 70mm; opacity: 0.85; width: 160mm; padding: 4mm 0; text-align: center; transform: rotate(-14deg); border: 1.2mm solid #C2362B; color: #C2362B; font-size: 38pt; font-weight: 700; letter-spacing: 3mm; }
            """;

    /**
     * Long texts get smaller type so that everything fits above the signature row: "dense" for a lot of text,
     * "compact" for somewhat long texts. The frontend preview applies the same rule.
     */
    static String density(PdfModel m) {
        int title = m.title() == null ? 0 : m.title().strip().length();
        int name = m.learnerName().length();
        int course = m.courseTitle().length();
        int custom = m.customText() == null ? 0 : m.customText().strip().length();
        int score = (custom > 160 ? 2 : custom > 0 ? 1 : 0) + (custom > 300 ? 1 : 0) + (course > 48 ? 1 : 0)
                + (course > 90 ? 1 : 0) + (name > 30 ? 1 : 0) + (title > 40 ? 1 : 0)
                + ("de".equals(m.locale().getLanguage()) ? 1 : 0);
        return score >= 4 ? "dense" : score >= 3 ? "compact" : "";
    }

    private String msg(Locale locale, String key, Object... args) {
        return messages.get(locale, key, args);
    }

    private static String percent(double value, Locale locale) {
        String number = value == Math.rint(value) ? String.valueOf((long) value)
                : String.format(locale, "%.1f", value);
        return locale.getLanguage().equals("de") ? number + " %" : number + "%";
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String esc(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s, "UTF-8");
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Images: the logo mark (same geometry as frontend/src/app/icon.svg) and the QR code, both as PNG data URIs
    // ---------------------------------------------------------------------------------------------------------------

    static BufferedImage logoMark(int size) {
        BufferedImage img = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            double s = size / 32.0;
            g.scale(s, s);
            g.setColor(new Color(0x151C38));
            g.fill(new RoundRectangle2D.Double(0, 0, 32, 32, 18, 18));
            Path2D path = new Path2D.Double();
            path.moveTo(6.5, 21.5);
            path.curveTo(9.7, 21.5, 11.1, 10.5, 16, 10.5);
            path.curveTo(20.9, 10.5, 22.3, 21.5, 25.5, 21.5);
            g.setColor(new Color(0xF2B544));
            g.setStroke(new BasicStroke(3f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.draw(path);
            g.setColor(new Color(0xFFF7E6));
            g.fill(new Ellipse2D.Double(16 - 2.2, 10.5 - 2.2, 4.4, 4.4));
        } finally {
            g.dispose();
        }
        return img;
    }

    static BufferedImage qr(String text) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0,
                    Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M, EncodeHintType.MARGIN, 0,
                            EncodeHintType.CHARACTER_SET, "UTF-8"));
            int scale = 8;
            int n = matrix.getWidth();
            BufferedImage img = new BufferedImage(n * scale, n * scale, BufferedImage.TYPE_INT_RGB);
            int ink = 0x151C38;
            int paper = 0xFFFCF5;
            for (int y = 0; y < n * scale; y++) {
                for (int x = 0; x < n * scale; x++) {
                    img.setRGB(x, y, matrix.get(x / scale, y / scale) ? ink : paper);
                }
            }
            return img;
        } catch (WriterException e) {
            throw new IllegalStateException("Could not encode QR code", e);
        }
    }

    private static String png(BufferedImage image) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
