package me.amanullah.course.media;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import me.amanullah.course.common.exception.ApiException;
import me.amanullah.course.user.Role;
import org.springframework.http.HttpStatus;

/**
 * Upload type rules, checked by file extension AND by sniffing the first bytes (magic numbers), never by the declared
 * {@code Content-Type}:
 * <ul>
 *   <li><b>Students</b> may upload an allow-list only: images, audio, PDF, DOCX, ODT and plain text. The stored
 *       content type is derived from the verified extension.</li>
 *   <li><b>Instructors and admins</b> may upload anything except executables and scripts (by extension or by
 *       executable/shebang magic bytes). HTML, SVG and XML are accepted but always served as attachments.</li>
 * </ul>
 * Violations → 415 {@code FILE_TYPE_NOT_ALLOWED}.
 */
public final class FileTypePolicy {

    /** Extensions that are never accepted (executables, installers, shell/script files). */
    static final Set<String> BLOCKED_EXT = Set.of("exe", "msi", "msp", "bat", "cmd", "com", "scr", "pif", "cpl",
            "ps1", "psm1", "vbs", "vbe", "js", "mjs", "cjs", "jse", "wsf", "wsh", "hta", "jar", "sh", "bash", "zsh",
            "csh", "ksh", "command", "app", "apk", "dll", "so", "dylib", "dmg", "pkg", "deb", "rpm", "php", "phtml",
            "py", "pyc", "pl", "rb", "cgi", "lnk", "reg", "inf", "gadget", "msc", "appimage", "run", "elf");

    /** Extensions that may contain active content: accepted for instructors, but always served as attachments. */
    public static final Set<String> ACTIVE_EXT = Set.of("html", "htm", "xhtml", "shtml", "svg", "svgz", "xml", "xsl",
            "xslt", "js", "mjs");

    private enum Sniff { PNG, JPEG, GIF, WEBP, HEIF, BMP, PDF, ZIP, MP3, WAV, OGG, FLAC, MP4, WEBM, AAC, TEXT, OTHER }

    /** Student allow-list: extension → (content type, accepted sniffed formats). */
    private record Allowed(String contentType, Set<Sniff> formats) {
    }

    private static final Map<String, Allowed> STUDENT_ALLOWED = Map.ofEntries(
            Map.entry("png", new Allowed("image/png", Set.of(Sniff.PNG))),
            Map.entry("jpg", new Allowed("image/jpeg", Set.of(Sniff.JPEG))),
            Map.entry("jpeg", new Allowed("image/jpeg", Set.of(Sniff.JPEG))),
            Map.entry("gif", new Allowed("image/gif", Set.of(Sniff.GIF))),
            Map.entry("webp", new Allowed("image/webp", Set.of(Sniff.WEBP))),
            Map.entry("avif", new Allowed("image/avif", Set.of(Sniff.HEIF))),
            Map.entry("heic", new Allowed("image/heic", Set.of(Sniff.HEIF))),
            Map.entry("heif", new Allowed("image/heif", Set.of(Sniff.HEIF))),
            Map.entry("bmp", new Allowed("image/bmp", Set.of(Sniff.BMP))),
            Map.entry("mp3", new Allowed("audio/mpeg", Set.of(Sniff.MP3))),
            Map.entry("wav", new Allowed("audio/wav", Set.of(Sniff.WAV))),
            Map.entry("ogg", new Allowed("audio/ogg", Set.of(Sniff.OGG))),
            Map.entry("oga", new Allowed("audio/ogg", Set.of(Sniff.OGG))),
            Map.entry("opus", new Allowed("audio/ogg", Set.of(Sniff.OGG))),
            Map.entry("flac", new Allowed("audio/flac", Set.of(Sniff.FLAC))),
            Map.entry("m4a", new Allowed("audio/mp4", Set.of(Sniff.MP4))),
            Map.entry("aac", new Allowed("audio/aac", Set.of(Sniff.AAC, Sniff.MP4))),
            // browser recordings (MediaRecorder): webm/opus, or mp4/aac on Safari; only with an audio/* type
            Map.entry("weba", new Allowed("audio/webm", Set.of(Sniff.WEBM))),
            Map.entry("webm", new Allowed("audio/webm", Set.of(Sniff.WEBM))),
            Map.entry("mp4", new Allowed("audio/mp4", Set.of(Sniff.MP4))),
            Map.entry("pdf", new Allowed("application/pdf", Set.of(Sniff.PDF))),
            Map.entry("docx", new Allowed("application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    Set.of(Sniff.ZIP))),
            Map.entry("odt", new Allowed("application/vnd.oasis.opendocument.text", Set.of(Sniff.ZIP))),
            Map.entry("txt", new Allowed("text/plain", Set.of(Sniff.TEXT))));

    /** Extensions recorded in the browser that are only allowed with a declared audio/* type. */
    private static final Set<String> AUDIO_ONLY_CONTAINERS = Set.of("webm", "mp4");

    private static final int HEAD = 8192;

    private FileTypePolicy() {
    }

    /** 415 FILE_TYPE_NOT_ALLOWED. */
    public static final class FileTypeNotAllowedException extends ApiException {
        FileTypeNotAllowedException(String key) {
            super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "FILE_TYPE_NOT_ALLOWED", "This file type is not allowed");
            key(key);
        }
    }

    /** Source of the upload's bytes (opened up to twice: head sniffing and, for DOCX/ODT, a ZIP scan). */
    @FunctionalInterface
    public interface Content {
        InputStream open() throws IOException;
    }

    /**
     * Checks the upload and returns the content type to store: for students the type that belongs to the verified
     * extension, otherwise {@code null} (keep the declared/derived type).
     */
    public static String check(Role role, String fileName, String declaredType, Content content) throws IOException {
        String ext = MediaKind.extension(fileName);
        byte[] head;
        try (InputStream in = content.open()) {
            head = in.readNBytes(HEAD);
        }
        Sniff sniff = sniff(head);
        if (role == Role.STUDENT) {
            Allowed allowed = STUDENT_ALLOWED.get(ext);
            if (allowed == null || !allowed.formats().contains(sniff)) {
                throw new FileTypeNotAllowedException("error.FILE_TYPE_NOT_ALLOWED.student");
            }
            if (AUDIO_ONLY_CONTAINERS.contains(ext)
                    && (declaredType == null || !declaredType.toLowerCase(Locale.ROOT).startsWith("audio/"))) {
                throw new FileTypeNotAllowedException("error.FILE_TYPE_NOT_ALLOWED.student");
            }
            if (sniff == Sniff.ZIP && !isOfficeDocument(ext, content)) {
                throw new FileTypeNotAllowedException("error.FILE_TYPE_NOT_ALLOWED.student");
            }
            return allowed.contentType();
        }
        if (BLOCKED_EXT.contains(ext) || isExecutable(head)) {
            throw new FileTypeNotAllowedException("error.FILE_TYPE_NOT_ALLOWED.executable");
        }
        return null;
    }

    /** True for extensions or content types that must never be rendered inline from the API origin. */
    public static boolean isActive(String fileName, String contentType) {
        if (ACTIVE_EXT.contains(MediaKind.extension(fileName))) {
            return true;
        }
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        return ct.contains("html") || ct.contains("svg") || ct.contains("xml") || ct.contains("javascript")
                || ct.contains("ecmascript");
    }

    static boolean isExecutable(byte[] h) {
        return isPortableExecutable(h)
                || startsWith(h, new byte[] {0x7F, 'E', 'L', 'F'})                           // ELF
                || startsWith(h, new byte[] {(byte) 0xCF, (byte) 0xFA, (byte) 0xED, (byte) 0xFE}) // Mach-O 64
                || startsWith(h, new byte[] {(byte) 0xCE, (byte) 0xFA, (byte) 0xED, (byte) 0xFE}) // Mach-O 32
                || startsWith(h, new byte[] {(byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE}) // Mach-O fat / class
                || startsWith(h, "#!".getBytes(StandardCharsets.US_ASCII));                 // shebang script
    }

    /** "MZ" DOS header whose e_lfanew points at a "PE\\0\\0" signature (or beyond the sniffed head). */
    private static boolean isPortableExecutable(byte[] h) {
        if (!startsWith(h, "MZ".getBytes(StandardCharsets.US_ASCII)) || h.length < 0x40) {
            return false;
        }
        int offset = (h[0x3C] & 0xFF) | (h[0x3D] & 0xFF) << 8 | (h[0x3E] & 0xFF) << 16 | (h[0x3F] & 0xFF) << 24;
        if (offset < 0x40 || offset + 4 > h.length) {
            return offset >= 0x40 && offset < (1 << 20);
        }
        return h[offset] == 'P' && h[offset + 1] == 'E' && h[offset + 2] == 0 && h[offset + 3] == 0;
    }

    private static Sniff sniff(byte[] h) {
        if (startsWith(h, new byte[] {(byte) 0x89, 'P', 'N', 'G'})) {
            return Sniff.PNG;
        }
        if (startsWith(h, new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})) {
            return Sniff.JPEG;
        }
        if (startsWith(h, "GIF8".getBytes(StandardCharsets.US_ASCII))) {
            return Sniff.GIF;
        }
        if (startsWith(h, "RIFF".getBytes(StandardCharsets.US_ASCII)) && at(h, 8, "WEBP")) {
            return Sniff.WEBP;
        }
        if (startsWith(h, "RIFF".getBytes(StandardCharsets.US_ASCII)) && at(h, 8, "WAVE")) {
            return Sniff.WAV;
        }
        if (at(h, 4, "ftyp")) {
            String brand = h.length >= 12 ? new String(h, 8, 4, StandardCharsets.US_ASCII) : "";
            return Set.of("avif", "avis", "heic", "heix", "hevc", "mif1", "msf1").contains(brand) ? Sniff.HEIF : Sniff.MP4;
        }
        if (startsWith(h, "BM".getBytes(StandardCharsets.US_ASCII)) && h.length > 26) {
            return Sniff.BMP;
        }
        if (startsWith(h, "%PDF-".getBytes(StandardCharsets.US_ASCII))) {
            return Sniff.PDF;
        }
        if (startsWith(h, new byte[] {'P', 'K', 3, 4})) {
            return Sniff.ZIP;
        }
        if (startsWith(h, "ID3".getBytes(StandardCharsets.US_ASCII))
                || (h.length > 1 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xE6) == 0xE2)) {
            return Sniff.MP3; // ID3 tag, or an MPEG audio frame sync (layer III/II)
        }
        if (h.length > 1 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xF6) == 0xF0) {
            return Sniff.AAC; // ADTS
        }
        if (startsWith(h, "OggS".getBytes(StandardCharsets.US_ASCII))) {
            return Sniff.OGG;
        }
        if (startsWith(h, "fLaC".getBytes(StandardCharsets.US_ASCII))) {
            return Sniff.FLAC;
        }
        if (startsWith(h, new byte[] {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3})) {
            return Sniff.WEBM;
        }
        if (isText(h)) {
            return Sniff.TEXT;
        }
        return Sniff.OTHER;
    }

    /** Plain text: no NUL/control bytes (except tab, CR, LF, FF, ESC) and no markup that a browser could render. */
    private static boolean isText(byte[] h) {
        for (byte b : h) {
            int c = b & 0xFF;
            if (c < 0x20 && c != '\t' && c != '\n' && c != '\r' && c != '\f' && c != 0x1B) {
                return false;
            }
        }
        String start = new String(h, 0, Math.min(h.length, 512), StandardCharsets.UTF_8).stripLeading()
                .toLowerCase(Locale.ROOT);
        return !(start.startsWith("<!doctype") || start.startsWith("<html") || start.startsWith("<svg")
                || start.startsWith("<?xml") || start.startsWith("<script") || start.startsWith("#!"));
    }

    /** DOCX must contain word/document.xml; ODT must declare the OpenDocument text mimetype. */
    private static boolean isOfficeDocument(String ext, Content content) throws IOException {
        try (ZipInputStream zip = new ZipInputStream(content.open())) {
            ZipEntry entry;
            int seen = 0;
            while ((entry = zip.getNextEntry()) != null && seen++ < 200) {
                String name = entry.getName();
                if (ext.equals("docx") && name.equals("word/document.xml")) {
                    return true;
                }
                if (ext.equals("odt") && name.equals("mimetype")) {
                    byte[] mime = zip.readNBytes(100);
                    return new String(mime, StandardCharsets.US_ASCII).trim()
                            .equals("application/vnd.oasis.opendocument.text");
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            return false;
        }
        return false;
    }

    private static boolean startsWith(byte[] h, byte[] prefix) {
        return h.length >= prefix.length && Arrays.equals(h, 0, prefix.length, prefix, 0, prefix.length);
    }

    private static boolean at(byte[] h, int offset, String ascii) {
        byte[] b = ascii.getBytes(StandardCharsets.US_ASCII);
        return h.length >= offset + b.length && Arrays.equals(h, offset, offset + b.length, b, 0, b.length);
    }
}
