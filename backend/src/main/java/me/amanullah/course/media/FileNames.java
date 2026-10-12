package me.amanullah.course.media;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;

/** Filename sanitizing and RFC 5987/6266 Content-Disposition building. */
public final class FileNames {

    private static final int MAX_LENGTH = 200;

    private FileNames() {
    }

    public static String sanitize(String name) {
        if (name == null || name.isBlank()) {
            return "datei";
        }
        String n = name.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1);
        n = Normalizer.normalize(n, Normalizer.Form.NFC)
                .replaceAll("[\\p{Cntrl}\"<>:|?*]", "_")
                .replaceAll("\\s+", " ")
                .trim();
        while (n.startsWith(".")) {
            n = n.substring(1);
        }
        if (n.length() > MAX_LENGTH) {
            int dot = n.lastIndexOf('.');
            String ext = dot > 0 && n.length() - dot <= 10 ? n.substring(dot) : "";
            n = n.substring(0, MAX_LENGTH - ext.length()) + ext;
        }
        return n.isBlank() ? "datei" : n;
    }

    public static String contentDisposition(String fileName, boolean attachment) {
        String ascii = Normalizer.normalize(fileName.replace("ß", "ss"), Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^\\x20-\\x7E]", "_")
                .replace("\\", "_")
                .replace("\"", "_");
        return (attachment ? "attachment" : "inline") + "; filename=\"" + ascii + "\"; filename*=UTF-8''"
                + rfc5987(fileName);
    }

    private static String rfc5987(String value) {
        StringBuilder sb = new StringBuilder();
        for (byte b : value.getBytes(StandardCharsets.UTF_8)) {
            int c = b & 0xFF;
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                    || "!#$&+-.^_`|~".indexOf(c) >= 0) {
                sb.append((char) c);
            } else {
                sb.append('%').append(Character.toUpperCase(Character.forDigit(c >> 4, 16)))
                        .append(Character.toUpperCase(Character.forDigit(c & 0xF, 16)));
            }
        }
        return sb.toString();
    }
}
