package me.amanullah.course.media;

import me.amanullah.course.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** 413 {@code QUOTA_EXCEEDED}: the upload would exceed the user's storage quota. */
public class QuotaExceededException extends ApiException {

    private final long usedBytes;
    private final long quotaBytes;
    private final long fileBytes;

    public QuotaExceededException(long usedBytes, long quotaBytes, long fileBytes) {
        super(HttpStatus.CONTENT_TOO_LARGE, "QUOTA_EXCEEDED", "Your storage quota is exhausted");
        this.usedBytes = usedBytes;
        this.quotaBytes = quotaBytes;
        this.fileBytes = fileBytes;
        key("error.QUOTA_EXCEEDED", StorageUsage.human(usedBytes), StorageUsage.human(quotaBytes));
    }

    public long getUsedBytes() { return usedBytes; }
    public long getQuotaBytes() { return quotaBytes; }
    public long getFileBytes() { return fileBytes; }
}
