package me.amanullah.course.media;

import java.util.Locale;
import java.util.Set;

public enum MediaKind {
    DOCUMENT, VIDEO, AUDIO, IMAGE, ARCHIVE, OTHER;

    private static final Set<String> DOCUMENT_EXT = Set.of("pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv",
            "xls", "xlsx", "ods", "ppt", "pptx", "odp", "epub", "pages", "key", "numbers");
    private static final Set<String> VIDEO_EXT = Set.of("mp4", "m4v", "webm", "mov", "mkv", "avi", "ogv");
    private static final Set<String> AUDIO_EXT = Set.of("mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba");
    private static final Set<String> IMAGE_EXT = Set.of("png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "heic");
    private static final Set<String> ARCHIVE_EXT = Set.of("zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz");

    /** Detects the kind from the content type first, falling back to the file extension. */
    public static MediaKind detect(String contentType, String fileName) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (ct.startsWith("image/")) {
            return IMAGE;
        }
        if (ct.startsWith("video/")) {
            return VIDEO;
        }
        if (ct.startsWith("audio/")) {
            return AUDIO;
        }
        if (ct.equals("application/pdf") || ct.startsWith("text/") || ct.contains("msword")
                || ct.contains("officedocument") || ct.contains("opendocument") || ct.contains("ms-excel")
                || ct.contains("ms-powerpoint") || ct.equals("application/rtf") || ct.equals("application/epub+zip")) {
            return DOCUMENT;
        }
        if (ct.contains("zip") || ct.contains("x-7z") || ct.contains("x-rar") || ct.contains("x-tar")
                || ct.contains("gzip") || ct.contains("x-bzip")) {
            return ARCHIVE;
        }
        String ext = extension(fileName);
        if (DOCUMENT_EXT.contains(ext)) {
            return DOCUMENT;
        }
        if (VIDEO_EXT.contains(ext)) {
            return VIDEO;
        }
        if (AUDIO_EXT.contains(ext)) {
            return AUDIO;
        }
        if (IMAGE_EXT.contains(ext)) {
            return IMAGE;
        }
        if (ARCHIVE_EXT.contains(ext)) {
            return ARCHIVE;
        }
        return OTHER;
    }

    static String extension(String fileName) {
        if (fileName == null) {
            return "";
        }
        int dot = fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
